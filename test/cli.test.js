import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { extractToolPayload, McpClient } from '../src/mcp-client.js';
import { parseArgs, run } from '../src/cli.js';
import { getStoredAuth, login, PROTECTED_RESOURCE_METADATA } from '../src/auth.js';

test('parses positional arguments and long options', () => {
  const parsed = parseArgs(['search', 'screens', 'pricing', 'page', '--platform', 'web', '--json']);
  assert.deepEqual(parsed.positional, ['search', 'screens', 'pricing', 'page']);
  assert.deepEqual(parsed.options, { platform: 'web', json: true });
});

test('returns the bundled agent skill without a network request', async () => {
  const stdout = { output: '', write(value) { this.output += value; } };
  await run(['skill'], { stdout, fetchImpl: async () => { throw new Error('network should not be used'); } });
  assert.match(stdout.output, /^---\nname: mobbin-design/);
  assert.match(stdout.output, /mobbin search screens/);
  assert.match(stdout.output, /synthesize a distinct result/);
});

test('extracts structured content, JSON text, and plain text', () => {
  assert.deepEqual(extractToolPayload({ structuredContent: { ok: true } }), { ok: true });
  assert.deepEqual(extractToolPayload({ content: [{ type: 'text', text: '{"ok":true}' }] }), { ok: true });
  assert.equal(extractToolPayload({ content: [{ type: 'text', text: '# Screen' }] }), '# Screen');
});

test('initializes an MCP session and calls an official Mobbin tool', async () => {
  const requests = [];
  const fetchImpl = async (_url, init) => {
    const body = JSON.parse(init.body);
    requests.push({ body, headers: init.headers });
    if (body.method === 'initialize') {
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: { protocolVersion: '2025-03-26' } }), { status: 200, headers: { 'content-type': 'application/json', 'mcp-session-id': 'session-test' } });
    }
    if (body.method === 'notifications/initialized') return new Response(null, { status: 202 });
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: { content: [{ type: 'text', text: '{"results":[]}' }] } }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const client = new McpClient({ token: 'secret', fetchImpl });
  const result = await client.callTool('search_screens', { query: 'editorial' });
  assert.deepEqual(extractToolPayload(result), { results: [] });
  assert.equal(requests[0].body.method, 'initialize');
  assert.equal(requests[2].body.params.name, 'search_screens');
  assert.equal(requests[2].headers.get('Authorization'), 'Bearer secret');
  assert.equal(requests[2].headers.get('Mcp-Session-Id'), 'session-test');
});

test('maps the documented search commands and generic call', async () => {
  const calls = [];
  const fetchImpl = async (_url, init) => {
    const body = JSON.parse(init.body);
    if (body.method === 'tools/call') calls.push(body.params);
    if (body.method === 'notifications/initialized') return new Response(null, { status: 202 });
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: { content: [{ type: 'text', text: '{}' }] } }), { headers: { 'content-type': 'application/json', 'mcp-session-id': 'test' } });
  };
  const stdout = { output: '', write(value) { this.output += value; } };
  await run(['search', 'screens', 'pricing page', '--platform', 'web', '--app', 'Stripe'], { fetchImpl, stdout, promptOnMissingToken: false });
  await run(['search', 'flows', 'signup onboarding'], { fetchImpl, stdout, promptOnMissingToken: false });
  await run(['search', 'sections', 'hero section'], { fetchImpl, stdout, promptOnMissingToken: false });
  await run(['call', 'search_screens', '--args', '{"query":"empty state"}', '--json'], { fetchImpl, stdout, promptOnMissingToken: false });
  assert.deepEqual(calls.map(({ name }) => name), ['search_screens', 'search_flows', 'search_sections', 'search_screens']);
  assert.deepEqual(calls[0].arguments, { query: 'pricing page', platform: 'web', app: 'Stripe' });
  assert.deepEqual(calls[3].arguments, { query: 'empty state' });
});

test('completes OAuth login with a loopback callback and stores credentials', async () => {
  const configDir = await mkdtemp(join(tmpdir(), 'mobbin-cli-'));
  const previousConfigDir = process.env.MOBBIN_CONFIG_DIR;
  process.env.MOBBIN_CONFIG_DIR = configDir;
  let callbackUrl;
  const fetchImpl = async (url, init = {}) => {
    if (url === PROTECTED_RESOURCE_METADATA) return new Response(JSON.stringify({ authorization_servers: ['https://auth.example'] }), { status: 200 });
    if (url === 'https://auth.example/.well-known/oauth-authorization-server') return new Response(JSON.stringify({ authorization_endpoint: 'https://auth.example/authorize', token_endpoint: 'https://auth.example/token', registration_endpoint: 'https://auth.example/register' }), { status: 200 });
    if (url === 'https://auth.example/register') return new Response(JSON.stringify({ client_id: 'client-test' }), { status: 201 });
    if (url === 'https://auth.example/token') return new Response(JSON.stringify({ access_token: 'access-test', refresh_token: 'refresh-test', expires_in: 3600 }), { status: 200 });
    throw new Error(`Unexpected fetch: ${url}`);
  };
  const stdout = { output: '', write(value) { this.output += value; } };
  try {
    await login({ stdout, fetchImpl, browser: (url) => { callbackUrl = new URL(url); const redirect = new URL(callbackUrl.searchParams.get('redirect_uri')); setTimeout(() => fetch(`${redirect.origin}${redirect.pathname}?code=code-test&state=${callbackUrl.searchParams.get('state')}`), 0); } });
    assert.equal((await getStoredAuth()).access_token, 'access-test');
    assert.match(stdout.output, /Mobbin credentials saved/);
  } finally {
    if (previousConfigDir === undefined) delete process.env.MOBBIN_CONFIG_DIR;
    else process.env.MOBBIN_CONFIG_DIR = previousConfigDir;
    await rm(configDir, { recursive: true, force: true });
  }
});
