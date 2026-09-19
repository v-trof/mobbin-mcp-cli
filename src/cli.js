#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { McpClient, MobbinError, DEFAULT_URL, extractToolPayload } from './mcp-client.js';
import { authPath, clearAuth, getStoredAuth, getValidAccessToken, login } from './auth.js';

const HELP = `Mobbin CLI — real-world UI references from your terminal

Usage:
  mobbin auth login|status|logout
  mobbin skill
  mobbin search screens <query> --platform ios|web [options]
  mobbin search flows <query> --platform ios|web [options]
  mobbin search sections <query> [options]
  mobbin call <tool-name> [--args JSON] [--json]

Search options:
  --mode deep|standard|fast       Screens only (fast is deprecated)
  --limit N                       Maximum results (screens/sections: 1-30; flows: 1-10)
  --page N                        Flow/section result page
  --exclude-screen-id UUID        Screens only; repeat up to 100 times
  --image-format webp|jpg         Image format for previews
  --task-intent TEXT              Short English description of the overall task

Environment:
  MOBBIN_TOKEN       Bearer token for Mobbin MCP (CI/advanced use)
  MOBBIN_MCP_URL     MCP endpoint (default: ${DEFAULT_URL})
  MOBBIN_CONFIG_DIR  Config directory override for isolated environments

Global options:
  --token TOKEN      Bearer token (overrides MOBBIN_TOKEN)
  --json             Print machine-readable JSON
  --help             Show this help
`;

function parseArgs(argv) {
  const positional = [];
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === '--') { positional.push(...argv.slice(i + 1)); break; }
    if (item.startsWith('--')) {
      const [key, inline] = item.slice(2).split('=', 2);
      if (['json', 'help'].includes(key)) options[key] = true;
      else {
        const value = inline ?? argv[++i];
        if (!value || value.startsWith('--')) throw new MobbinError(`Missing value for --${key}`);
        if (key === 'exclude-screen-id' || key === 'exclude-screen-ids') options[key] = [...(options[key] || []), value];
        else options[key] = value;
      }
    } else positional.push(item);
  }
  return { positional, options };
}

function need(value, label) {
  if (!value) throw new MobbinError(`Missing ${label}. Use --help for usage.`);
  return value;
}

function printPayload(payload, json, stdout = process.stdout) {
  if (json) stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  else if (typeof payload === 'string') stdout.write(`${payload.trim()}\n`);
  else stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

function integerOption(options, key, { min, max } = {}) {
  if (options[key] === undefined) return undefined;
  const value = Number(options[key]);
  if (!Number.isSafeInteger(value) || (min !== undefined && value < min) || (max !== undefined && value > max)) {
    throw new MobbinError(`--${key} must be an integer${min !== undefined ? ` from ${min}` : ''}${max !== undefined ? ` to ${max}` : ''}.`);
  }
  return value;
}

function searchArgs(query, kind, options) {
  const args = { query };
  const platformKinds = new Set(['screens', 'flows']);
  if (platformKinds.has(kind)) {
    const platform = need(options.platform, `--platform for ${kind}`).toLowerCase();
    if (!['ios', 'web'].includes(platform)) throw new MobbinError('--platform must be ios or web.');
    args.platform = platform;
  } else if (options.platform) {
    throw new MobbinError('--platform is only supported for screens and flows.');
  }
  if (options.app) throw new MobbinError('--app is not supported by the current Mobbin MCP contract; include the app name in the query.');
  if (options.mode !== undefined) {
    if (kind !== 'screens') throw new MobbinError('--mode is only supported for screens.');
    if (!['deep', 'standard', 'fast'].includes(options.mode.toLowerCase())) throw new MobbinError('--mode must be deep, standard, or fast.');
    args.mode = options.mode.toLowerCase();
  }
  if (options['exclude-screen-id'] || options['exclude-screen-ids']) {
    if (kind !== 'screens') throw new MobbinError('--exclude-screen-id is only supported for screens.');
    const values = [...(options['exclude-screen-id'] || []), ...(options['exclude-screen-ids'] || [])]
      .flatMap((value) => value.split(',').map((item) => item.trim()).filter(Boolean));
    if (values.length > 100) throw new MobbinError('--exclude-screen-id accepts at most 100 IDs.');
    args.exclude_screen_ids = values;
  }
  if (options.limit !== undefined) args.limit = integerOption(options, 'limit', { min: 1, max: kind === 'flows' ? 10 : 30 });
  if (options.page !== undefined) {
    if (!['flows', 'sections'].includes(kind)) throw new MobbinError('--page is only supported for flows and sections.');
    args.page = integerOption(options, 'page', { min: 1, max: kind === 'flows' ? 20 : Number.MAX_SAFE_INTEGER });
  }
  if (options['image-format'] !== undefined) {
    const format = options['image-format'].toLowerCase();
    if (!['webp', 'jpg'].includes(format)) throw new MobbinError('--image-format must be webp or jpg.');
    args.image_format = format;
  }
  if (options['task-intent'] !== undefined) args.task_intent = options['task-intent'];
  return args;
}

async function run(argv, io = {}) {
  const stdout = io.stdout ?? process.stdout;
  const { positional, options } = parseArgs(argv);
  if (options.help || positional.length === 0 || positional[0] === 'help') { stdout.write(HELP); return; }
  const [command, kind, ...rest] = positional;
  if (command === 'skill') {
    const content = await readFile(new URL('../skill/SKILL.md', import.meta.url), 'utf8');
    printPayload(options.json ? { name: 'mobbin-design', content } : content, options.json, stdout);
    return;
  }
  if (command === 'auth') {
    if (kind === 'login') { await login({ stdin: io.stdin, stdout, browser: io.browser, fetchImpl: io.fetchImpl }); return; }
    if (kind === 'logout') { await clearAuth(); stdout.write('Signed out.\n'); return; }
    if (kind === 'status') {
      const auth = await getStoredAuth();
      printPayload(auth?.access_token
        ? { signed_in: true, config: authPath(), obtained_at: auth.obtained_at, expires_at: auth.expires_in && auth.obtained_at ? auth.obtained_at + auth.expires_in * 1000 : undefined }
        : { signed_in: false, config: authPath() }, options.json, stdout);
      return;
    }
    throw new MobbinError('Auth command must be login, status, or logout.');
  }

  const token = options.token || process.env.MOBBIN_TOKEN;
  let storedToken = token ? undefined : await getValidAccessToken({ fetchImpl: io.fetchImpl });
  if (!token && !storedToken && (io.promptOnMissingToken ?? Boolean(process.stdin.isTTY))) {
    storedToken = await login({ stdin: io.stdin, stdout, browser: io.browser, fetchImpl: io.fetchImpl });
  }
  const client = new McpClient({ url: process.env.MOBBIN_MCP_URL || DEFAULT_URL, token: token || storedToken, fetchImpl: io.fetchImpl });
  let result;
  if (command === 'search') {
    const normalized = kind?.toLowerCase();
    const tool = { screens: 'search_screens', screen: 'search_screens', flows: 'search_flows', flow: 'search_flows', sections: 'search_sections', section: 'search_sections' }[normalized];
    if (!tool) throw new MobbinError('Search target must be screens, flows, or sections.');
    const query = need(rest.join(' '), 'query');
    const searchKind = { screen: 'screens', flow: 'flows', section: 'sections' }[normalized] || normalized;
    result = await client.callTool(tool, searchArgs(query, searchKind, options));
  } else if (command === 'call') {
    const tool = need(kind, 'tool name');
    let args = {};
    if (options.args) {
      try { args = JSON.parse(options.args); } catch (error) { throw new MobbinError('--args must be valid JSON.', { cause: error }); }
      if (!args || typeof args !== 'object' || Array.isArray(args)) throw new MobbinError('--args must be a JSON object.');
    }
    result = await client.callTool(tool, args);
  } else {
    throw new MobbinError(`Unknown command: ${command}. Use --help for usage.`);
  }
  printPayload(options.json ? extractToolPayload(result, { preserveResponse: true }) : extractToolPayload(result), options.json, stdout);
}

const launchedDirectly = process.argv[1] && path.resolve(process.argv[1]).toLowerCase() === path.resolve(fileURLToPath(import.meta.url)).toLowerCase();
if (launchedDirectly) {
  run(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`mobbin: ${error.message}\n`);
    process.exitCode = 1;
  });
}

export { HELP, parseArgs, run };
