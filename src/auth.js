import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdir, readFile, rm, writeFile, chmod } from 'node:fs/promises';
import { homedir } from 'node:os';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { MobbinError } from './mcp-client.js';

const RESOURCE_URL = 'https://api.mobbin.com/mcp';
const PROTECTED_RESOURCE_METADATA = 'https://api.mobbin.com/.well-known/oauth-protected-resource/mcp';
const CONFIG_DIR_ENV = 'MOBBIN_CONFIG_DIR';

function configPath() {
  const root = process.env[CONFIG_DIR_ENV] || (process.platform === 'win32'
    ? process.env.APPDATA || path.join(homedir(), 'AppData', 'Roaming')
    : process.env.XDG_CONFIG_HOME || path.join(homedir(), '.config'));
  return path.join(root, 'mobbin', 'config.json');
}

async function readConfig() {
  try { return JSON.parse(await readFile(configPath(), 'utf8')); }
  catch (error) {
    if (error.code === 'ENOENT' || error instanceof SyntaxError) return {};
    throw error;
  }
}

async function writeConfig(config) {
  const filename = configPath();
  await mkdir(path.dirname(filename), { recursive: true });
  await writeFile(filename, `${JSON.stringify(config, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  if (process.platform !== 'win32') await chmod(filename, 0o600);
}

export async function getStoredAuth() { return (await readConfig()).auth || null; }

function isExpired(auth) {
  return Boolean(auth?.expires_in && auth?.obtained_at && Date.now() >= auth.obtained_at + auth.expires_in * 1000 - 30_000);
}

async function refreshAuth(auth, fetchImpl = globalThis.fetch) {
  if (!auth?.refresh_token || !auth?.token_endpoint || !auth?.client_id) return null;
  const body = new URLSearchParams({
    grant_type: 'refresh_token', refresh_token: auth.refresh_token, client_id: auth.client_id
  });
  const response = await fetchImpl(auth.token_endpoint, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  const payload = await response.json();
  if (!response.ok || !payload.access_token) throw new MobbinError(`Mobbin token refresh failed (${response.status}).`);
  const refreshed = { ...auth, ...payload, obtained_at: Date.now() };
  await saveAuth(refreshed);
  return refreshed.access_token;
}

export async function getValidAccessToken({ fetchImpl = globalThis.fetch } = {}) {
  const auth = await getStoredAuth();
  if (!auth?.access_token) return undefined;
  if (!isExpired(auth)) return auth.access_token;
  return refreshAuth(auth, fetchImpl);
}

export async function saveAuth(auth) {
  const config = await readConfig();
  await writeConfig({ ...config, auth });
}

export async function clearAuth() {
  const filename = configPath();
  const config = await readConfig();
  if (!config.auth) return;
  const { auth: _removed, ...remaining } = config;
  if (Object.keys(remaining).length) await writeConfig(remaining);
  else {
    try { await rm(filename); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
}

function openBrowser(url) {
  const command = process.platform === 'win32' ? 'cmd' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
  const child = spawn(command, args, { detached: true, stdio: 'ignore', windowsHide: true });
  child.unref();
}

function base64Url(buffer) { return buffer.toString('base64').replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', ''); }
function pkceChallenge(verifier) { return base64Url(createHash('sha256').update(verifier).digest()); }

async function discoverOAuth(fetchImpl) {
  const protectedResponse = await fetchImpl(PROTECTED_RESOURCE_METADATA);
  if (!protectedResponse.ok) throw new MobbinError(`Mobbin OAuth discovery failed (${protectedResponse.status}).`);
  const protectedMetadata = await protectedResponse.json();
  const issuer = protectedMetadata.authorization_servers?.[0];
  if (!issuer) throw new MobbinError('Mobbin did not advertise an OAuth authorization server.');
  const metadataResponse = await fetchImpl(`${issuer}/.well-known/oauth-authorization-server`);
  if (!metadataResponse.ok) throw new MobbinError(`Mobbin OAuth metadata failed (${metadataResponse.status}).`);
  return { protectedMetadata, metadata: await metadataResponse.json() };
}

async function registerClient(metadata, redirectUri, fetchImpl) {
  const response = await fetchImpl(metadata.registration_endpoint, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_name: 'mobbin-mcp-cli', client_type: 'public', redirect_uris: [redirectUri],
      grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'],
      token_endpoint_auth_method: 'none'
    })
  });
  const payload = await response.json();
  if (!response.ok || !payload.client_id) throw new MobbinError(`Mobbin OAuth client registration failed (${response.status}).`);
  return payload;
}

function waitForCallback(server, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { server.close(); reject(new MobbinError('Timed out waiting for Mobbin authorization.')); }, timeoutMs);
    server.on('request', (request, response) => {
      const url = new URL(request.url, 'http://127.0.0.1');
      if (url.pathname !== '/callback') { response.writeHead(404); response.end('Not found'); return; }
      clearTimeout(timer);
      response.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Mobbin authorization complete. You can close this tab.');
      server.close();
      resolve(Object.fromEntries(url.searchParams.entries()));
    });
  });
}

export async function login({ stdin = process.stdin, stdout = process.stdout, browser = openBrowser, fetchImpl = globalThis.fetch, timeoutMs = 300_000 } = {}) {
  const { metadata } = await discoverOAuth(fetchImpl);
  const verifier = base64Url(randomBytes(32));
  const state = randomUUID();
  const server = createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const address = server.address();
  const redirectUri = `http://127.0.0.1:${address.port}/callback`;
  const client = await registerClient(metadata, redirectUri, fetchImpl);
  const authorizationUrl = new URL(metadata.authorization_endpoint);
  authorizationUrl.search = new URLSearchParams({
    response_type: 'code', client_id: client.client_id, state,
    code_challenge: pkceChallenge(verifier), code_challenge_method: 'S256',
    redirect_uri: redirectUri, scope: 'openid offline_access', resource: RESOURCE_URL
  }).toString();
  stdout.write(`Authorize Mobbin by opening this URL in your browser:\n${authorizationUrl}\n`);
  browser(authorizationUrl.toString());
  try {
    const callback = await waitForCallback(server, timeoutMs);
    if (callback.error) throw new MobbinError(`Mobbin authorization failed: ${callback.error_description || callback.error}`);
    if (callback.state !== state) throw new MobbinError('Mobbin authorization state did not match.');
    if (!callback.code) throw new MobbinError('Mobbin authorization returned no code.');
    const tokenResponse = await fetchImpl(metadata.token_endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'authorization_code', code: callback.code, client_id: client.client_id, redirect_uri: redirectUri, code_verifier: verifier, resource: RESOURCE_URL })
    });
    const tokens = await tokenResponse.json();
    if (!tokenResponse.ok || !tokens.access_token) throw new MobbinError(`Mobbin token exchange failed (${tokenResponse.status}).`);
    await saveAuth({ ...tokens, client_id: client.client_id, token_endpoint: metadata.token_endpoint, obtained_at: Date.now() });
    stdout.write(`Mobbin credentials saved to ${configPath()}\n`);
    return tokens.access_token;
  } catch (error) {
    server.close();
    throw error;
  }
}

export function authPath() { return configPath(); }
export { PROTECTED_RESOURCE_METADATA };
