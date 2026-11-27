import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { extractToolPayload, McpClient } from '../src/mcp-client.js';
import { parseArgs, run } from '../src/cli.js';
import { getStoredAuth, login, PROTECTED_RESOURCE_METADATA } from '../src/auth.js';
import { INSTALL_MARKER, readSkill } from '../src/skills.js';
import { AXES, drawSeeds } from '../src/seeds.js';

// Keep the developer's saved Mobbin login out of the tests; an expired one would trigger a refresh through the mocked fetch.
const configDir = await mkdtemp(join(tmpdir(), 'mobbin-config-'));
process.env.MOBBIN_CONFIG_DIR = configDir;
after(() => rm(configDir, { recursive: true, force: true }));

const offline = () => ({ stdout: { output: '', write(value) { this.output += value; } }, fetchImpl: async () => { throw new Error('network should not be used'); } });
const exists = (file) => stat(file).then(() => true, () => false);

test('parses positional arguments and long options', () => {
  const parsed = parseArgs(['search', 'screens', 'pricing', 'page', '--platform', 'web', '--json']);
  assert.deepEqual(parsed.positional, ['search', 'screens', 'pricing', 'page']);
  assert.deepEqual(parsed.options, { platform: 'web', json: true });
  assert.deepEqual(parseArgs(['search', 'screens', 'x', '--platform', 'ios', '--exclude-screen-id', 'a', '--exclude-screen-id=b']).options, {
    platform: 'ios', 'exclude-screen-id': ['a', 'b']
  });
});

test('returns the bundled agent skill without a network request', async () => {
  const stdout = { output: '', write(value) { this.output += value; } };
  await run(['skill'], { stdout, fetchImpl: async () => { throw new Error('network should not be used'); } });
  assert.match(stdout.output, /^---\r?\nname: mobbin-design/);
  assert.match(stdout.output, /mobbin search screens/);
  assert.match(stdout.output, /synthesize a distinct result/);
  assert.match(stdout.output, /image-format/);
  assert.match(stdout.output, /mobbin_url/);
});

test('lists bundled skills and prints a skill or one of its references', async () => {
  const io = offline();
  await run(['skill', 'list', '--json'], io);
  const skills = JSON.parse(io.stdout.output);
  assert.deepEqual(skills.map(({ name }) => name), ['design-explore', 'design-floor', 'design-redesign', 'mobbin-design']);
  assert.deepEqual(skills.filter(({ userInvoked }) => userInvoked).map(({ name }) => name), ['design-explore']);
  assert.ok(skills.every(({ description }) => description && !/[<>]/.test(description)));

  const floor = offline();
  await run(['skill', 'design-floor'], floor);
  assert.match(floor.stdout.output, /^---\r?\nname: design-floor/);
  const fix = offline();
  await run(['skill', 'design-redesign', '--ref', 'fix', '--json'], fix);
  assert.deepEqual(Object.keys(JSON.parse(fix.stdout.output)), ['name', 'ref', 'content']);
  assert.match(JSON.parse(fix.stdout.output).content, /^# Fix mode/);

  await assert.rejects(run(['skill', 'nope'], offline()), /Unknown skill: nope/);
  await assert.rejects(run(['skill', 'design-redesign', '--ref', 'missing.md'], offline()), /Available: fix.md, variants.md/);
  await assert.rejects(run(['skill', 'design-redesign', '--ref', '../SKILL.md'], offline()), /has no reference/);
});

test('every mobbin skill command referenced inside the skills resolves', async () => {
  const skillsDir = new URL('../skills/', import.meta.url);
  const files = [];
  for (const name of await readdir(skillsDir)) {
    files.push(new URL(`${name}/SKILL.md`, skillsDir));
    const refs = await readdir(new URL(`${name}/references/`, skillsDir)).catch(() => []);
    files.push(...refs.map((ref) => new URL(`${name}/references/${ref}`, skillsDir)));
  }
  const commands = new Set();
  for (const file of files) {
    for (const [, name, ref] of (await readFile(file, 'utf8')).matchAll(/mobbin skill ([a-z][a-z-]+)(?: --ref ([\w.-]+))?/g)) {
      if (!['list', 'install'].includes(name)) commands.add(JSON.stringify([name, ref]));
    }
  }
  assert.ok(commands.size >= 5);
  for (const command of commands) {
    const [name, ref] = JSON.parse(command);
    await assert.doesNotReject(readSkill(name, ref ?? undefined), `mobbin skill ${name}${ref ? ` --ref ${ref}` : ''}`);
  }
});

test('installs skills with a marker and per-harness user-only invocation', async () => {
  const root = await mkdtemp(join(tmpdir(), 'mobbin-skills-'));
  try {
    const io = offline();
    await run(['skill', 'install', '--dir', join(root, 'agents'), '--json'], io);
    assert.equal(JSON.parse(io.stdout.output).length, 4);
    assert.ok(await exists(join(root, 'agents', 'design-redesign', 'references', 'variants.md')));
    assert.ok(await exists(join(root, 'agents', 'design-floor', INSTALL_MARKER)));
    assert.equal(await readFile(join(root, 'agents', 'design-explore', 'agents', 'openai.yaml'), 'utf8'), 'policy:\n  allow_implicit_invocation: false\n');
    assert.equal(await exists(join(root, 'agents', 'design-floor', 'agents', 'openai.yaml')), false);

    await run(['skill', 'install', 'design-explore', 'design-floor', '--target', 'claude', '--dir', join(root, 'claude')], offline());
    assert.match(await readFile(join(root, 'claude', 'design-explore', 'SKILL.md'), 'utf8'), /^---\r?\nname: design-explore\r?\n[\s\S]*\r?\ndisable-model-invocation: true\r?\n---\r?\n/);
    assert.doesNotMatch(await readFile(join(root, 'claude', 'design-floor', 'SKILL.md'), 'utf8'), /disable-model-invocation/);
    assert.equal(await exists(join(root, 'claude', 'design-redesign')), false);

    // A managed folder is replaced on reinstall; stale files from older versions go away.
    await writeFile(join(root, 'claude', 'design-floor', 'stale.md'), 'old');
    await run(['skill', 'install', 'design-floor', '--target', 'claude', '--dir', join(root, 'claude')], offline());
    assert.equal(await exists(join(root, 'claude', 'design-floor', 'stale.md')), false);

    // A folder mobbin didn't install is left alone unless --force, and nothing else is written first.
    await mkdir(join(root, 'mine', 'design-redesign'), { recursive: true });
    await writeFile(join(root, 'mine', 'design-redesign', 'SKILL.md'), 'custom');
    await assert.rejects(run(['skill', 'install', '--dir', join(root, 'mine')], offline()), /was not installed by mobbin/);
    assert.equal(await exists(join(root, 'mine', 'design-floor')), false);
    assert.equal(await readFile(join(root, 'mine', 'design-redesign', 'SKILL.md'), 'utf8'), 'custom');
    await run(['skill', 'install', 'design-redesign', '--dir', join(root, 'mine'), '--force'], offline());
    assert.ok(await exists(join(root, 'mine', 'design-redesign', INSTALL_MARKER)));

    await assert.rejects(run(['skill', 'install'], offline()), /Pass --target/);
    await assert.rejects(run(['skill', 'install', '--target', 'cursor'], offline()), /--target must be one of/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('draws reproducible, orthogonal design seeds', async () => {
  const first = await drawSeeds({ count: 5, seed: 'brief-1' });
  assert.deepEqual(await drawSeeds({ count: 5, seed: 'brief-1' }), first);
  assert.notDeepEqual((await drawSeeds({ count: 5, seed: 'brief-2' })).directions, first.directions);
  assert.deepEqual(first.directions.map(({ id }) => id), ['A', 'B', 'C', 'D', 'E']);
  for (const axis of AXES) assert.ok(first.directions.every((direction) => direction[axis].id && direction[axis].prompt), axis);
  for (const axis of ['structure', 'world']) assert.equal(new Set(first.directions.map((direction) => direction[axis].id)).size, 5, axis);
  assert.deepEqual(first.directions.map(({ wild }) => Boolean(wild)), [false, false, false, false, true]);
  assert.equal((await drawSeeds({ count: 2, seed: 'x' })).directions.some(({ wild }) => wild), false);

  const used = first.directions.map(({ world }) => world.id);
  const redraw = await drawSeeds({ count: 1, seed: 'brief-1', avoid: used });
  assert.ok(!used.includes(redraw.directions[0].world.id));
  await assert.rejects(drawSeeds({ avoid: ['not-an-id'] }), /Unknown --avoid id: not-an-id/);

  const io = offline();
  await run(['seeds', '--count', '3', '--seed', '42', '--avoid', 'ledger'], io);
  assert.match(io.stdout.output, /^Seed 42\. Reproduce with: mobbin seeds --count 3 --seed 42 --avoid ledger\n\nA\n  Structure /);
  assert.match(io.stdout.output, /\nC \(wild\)\n[\s\S]*  Twist /);
  assert.doesNotMatch(io.stdout.output, /\(ledger\)/);
  await assert.rejects(run(['seeds', '--count', '9'], offline()), /--count must be an integer from 1 to 8/);
});

test('extracts structured content, JSON text, and plain text', () => {
  assert.deepEqual(extractToolPayload({ structuredContent: { ok: true } }), { ok: true });
  assert.deepEqual(extractToolPayload({ content: [{ type: 'text', text: '{"ok":true}' }] }), { ok: true });
  assert.equal(extractToolPayload({ content: [{ type: 'text', text: '# Screen' }] }), '# Screen');
  const response = { structuredContent: { screens: [] }, content: [{ type: 'image', mimeType: 'image/webp', data: 'encoded' }] };
  assert.deepEqual(extractToolPayload(response, { preserveResponse: true }), response);
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
  await run(['search', 'screens', 'pricing page', '--platform', 'web', '--mode', 'standard', '--limit', '12', '--exclude-screen-id', 'screen-a', '--image-format', 'jpg', '--task-intent', 'Choose a pricing direction', '--output-destination', 'code'], { fetchImpl, stdout, promptOnMissingToken: false });
  await run(['search', 'flows', 'signup onboarding', '--platform', 'ios', '--page', '2', '--limit', '3'], { fetchImpl, stdout, promptOnMissingToken: false });
  await run(['search', 'sections', 'hero section', '--page', '2', '--limit', '4', '--image-format', 'webp', '--output-destination', 'design-tool', '--output-tool', 'Figma'], { fetchImpl, stdout, promptOnMissingToken: false });
  await run(['call', 'search_screens', '--args', '{"query":"empty state","platform":"ios"}', '--json'], { fetchImpl, stdout, promptOnMissingToken: false });
  assert.deepEqual(calls.map(({ name }) => name), ['search_screens', 'search_flows', 'search_sections', 'search_screens']);
  assert.deepEqual(calls[0].arguments, { query: 'pricing page', platform: 'web', mode: 'standard', exclude_screen_ids: ['screen-a'], limit: 12, image_format: 'jpg', task_intent: 'Choose a pricing direction', output_destination: 'code' });
  assert.deepEqual(calls[1].arguments, { query: 'signup onboarding', platform: 'ios', limit: 3, page: 2 });
  assert.deepEqual(calls[2].arguments, { query: 'hero section', limit: 4, page: 2, image_format: 'webp', output_destination: 'design_tool', output_tool: 'Figma' });
  assert.deepEqual(calls[3].arguments, { query: 'empty state', platform: 'ios' });
});

test('preserves inline media in JSON output', async () => {
  const fetchImpl = async (_url, init) => {
    const body = JSON.parse(init.body);
    if (body.method === 'notifications/initialized') return new Response(null, { status: 202 });
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: { structuredContent: { screens: [] }, content: [{ type: 'text', text: '{"screens":[]}' }, { type: 'image', mimeType: 'image/webp', data: 'encoded' }] } }), { headers: { 'content-type': 'application/json', 'mcp-session-id': 'test' } });
  };
  const stdout = { output: '', write(value) { this.output += value; } };
  await run(['call', 'search_screens', '--json'], { fetchImpl, stdout, promptOnMissingToken: false });
  const payload = JSON.parse(stdout.output);
  assert.deepEqual(payload.structuredContent, { screens: [] });
  assert.equal(payload.content[1].mimeType, 'image/webp');
});

test('retries rate-limited MCP requests using Retry-After', async () => {
  const waits = [];
  let toolAttempts = 0;
  const fetchImpl = async (_url, init) => {
    const body = JSON.parse(init.body);
    if (body.method === 'notifications/initialized') return new Response(null, { status: 202 });
    if (body.method === 'tools/call' && toolAttempts++ === 0) return new Response('{"error":"slow down"}', { status: 429, headers: { 'retry-after': '0' } });
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: { content: [{ type: 'text', text: '{"ok":true}' }] } }), { headers: { 'content-type': 'application/json', 'mcp-session-id': 'test' } });
  };
  const client = new McpClient({ fetchImpl, sleep: async (ms) => waits.push(ms), random: () => 0 });
  assert.deepEqual(extractToolPayload(await client.callTool('search_sections', { query: 'pricing' })), { ok: true });
  assert.deepEqual(waits, [0]);
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

test('rejects invalid output destinations and overlong queries', async () => {
  const io = { fetchImpl: async () => { throw new Error('network should not be used'); }, stdout: { write() {} }, promptOnMissingToken: false };
  await assert.rejects(run(['search', 'sections', 'hero', '--output-destination', 'slack'], io), /--output-destination must be one of/);
  await assert.rejects(run(['search', 'sections', 'x'.repeat(501)], io), /at most 500 characters/);
});

test('lists server tools and surfaces AI usage notices', async () => {
  const fetchImpl = async (_url, init) => {
    const body = JSON.parse(init.body);
    if (body.method === 'notifications/initialized') return new Response(null, { status: 202 });
    if (body.method === 'tools/list') {
      const page = body.params.cursor
        ? { tools: [{ name: 'search_flows', title: 'Flows', description: 'f', inputSchema: {} }] }
        : { tools: [{ name: 'search_screens', title: 'Screens', description: 's', inputSchema: {} }], nextCursor: 'next' };
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: page }), { headers: { 'content-type': 'application/json', 'mcp-session-id': 'test' } });
    }
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: { structuredContent: { screens: [], ai_usage_notice: { text: '**Heads up**\nUsage is high.',credits_used: 9 } } } }), { headers: { 'content-type': 'application/json', 'mcp-session-id': 'test' } });
  };
  const stdout = { output: '', write(value) { this.output += value; } };
  const stderr = { output: '', write(value) { this.output += value; } };
  await run(['tools'], { fetchImpl, stdout, promptOnMissingToken: false });
  assert.deepEqual(JSON.parse(stdout.output).map(({ name }) => name), ['search_screens', 'search_flows']);
  await run(['search', 'screens', 'login', '--platform', 'ios'], { fetchImpl, stdout: { write() {} }, stderr, promptOnMissingToken: false });
  assert.equal(stderr.output, '\n**Heads up**\nUsage is high.\n');
});

test('maps collection, save, and comment commands', async () => {
  const calls = [];
  const fetchImpl = async (_url, init) => {
    const body = JSON.parse(init.body);
    if (body.method === 'tools/call') calls.push(body.params);
    if (body.method === 'notifications/initialized') return new Response(null, { status: 202 });
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: { content: [{ type: 'text', text: '{}' }] } }), { headers: { 'content-type': 'application/json', 'mcp-session-id': 'test' } });
  };
  const io = { fetchImpl, stdout: { write() {} }, promptOnMissingToken: false };
  const a = '11111111-1111-4111-8111-111111111111';
  const b = '22222222-2222-4222-8222-222222222222';
  await run(['collections', 'list', '--output-destination', 'chat'], io);
  await run(['collections', 'get', 'all-saved', '--type', 'flows', '--platform', 'ios', '--page', '2', '--limit', '5', '--image-format', 'jpg'], io);
  await run(['collections', 'get', a, '--type', 'section'], io);
  await run(['collections', 'create', 'Checkout', 'ideas', '--description', 'Payment flows', '--task-intent', 'Design checkout'], io);
  await run(['save', 'screens', a, `${b}`], io);
  await run(['save', 'flow', `${a},${b}`, '--collection', b], io);
  await run(['comment', 'screens', a, 'Good', 'empty', 'state'], io);
  assert.deepEqual(calls.map(({ name }) => name), ['list_collections', 'get_collection_contents', 'get_collection_contents', 'create_collection', 'save_content', 'save_content', 'add_comment']);
  assert.deepEqual(calls[0].arguments, { output_destination: 'chat' });
  assert.deepEqual(calls[1].arguments, { id: 'all-saved', content_type: 'flows', platform: 'ios', page: 2, limit: 5, image_format: 'jpg' });
  assert.deepEqual(calls[2].arguments, { id: a, content_type: 'sections' });
  assert.deepEqual(calls[3].arguments, { name: 'Checkout ideas', description: 'Payment flows', task_intent: 'Design checkout' });
  assert.deepEqual(calls[4].arguments, { collection_id: 'all-saved', contents: [{ id: a, content_type: 'screens' }, { id: b, content_type: 'screens' }] });
  assert.deepEqual(calls[5].arguments, { collection_id: b, contents: [{ id: a, content_type: 'flows' }, { id: b, content_type: 'flows' }] });
  assert.deepEqual(calls[6].arguments, { content_id: a, content_type: 'screens', comment: 'Good empty state' });
});

test('validates collection, save, and comment arguments locally', async () => {
  const io = { fetchImpl: async () => { throw new Error('network should not be used'); }, stdout: { write() {} }, promptOnMissingToken: false };
  const a = '11111111-1111-4111-8111-111111111111';
  await assert.rejects(run(['collections', 'get', 'all-saved', '--type', 'screens'], io), /--platform for screens/);
  await assert.rejects(run(['collections', 'get', 'all-saved', '--type', 'sections', '--platform', 'web'], io), /only supported for screens and flows/);
  await assert.rejects(run(['collections', 'get', 'all-saved', '--type', 'flows', '--platform', 'ios', '--limit', '11'], io), /--limit must be an integer from 1 to 10/);
  await assert.rejects(run(['collections', 'get', 'not-a-uuid', '--type', 'sections'], io), /must be a UUID/);
  await assert.rejects(run(['collections', 'delete', a], io), /must be list, get, or create/);
  await assert.rejects(run(['save', 'apps', a], io), /must be screens, flows, or sections/);
  await assert.rejects(run(['save', 'screens', 'abc'], io), /must be a UUID/);
  await assert.rejects(run(['save', 'screens', a, '--output-destination', 'code'], io), /not supported for this command/);
  await assert.rejects(run(['comment', 'screens', a], io), /Missing comment text/);
});
