const DEFAULT_URL = 'https://api.mobbin.com/mcp';
const CLIENT_NAME = 'mobbin-mcp-cli';
const CLIENT_VERSION = '0.1.0';

export class MobbinError extends Error {
  constructor(message, { status, cause } = {}) {
    super(message, { cause });
    this.name = 'MobbinError';
    this.status = status;
  }
}

function parseSse(body) {
  const messages = [];
  let data = [];
  for (const line of body.split(/\r?\n/)) {
    if (line.startsWith('data:')) data.push(line.slice(5).trimStart());
    if (line === '' && data.length) {
      const payload = data.join('\n');
      if (payload !== '[DONE]') {
        try { messages.push(JSON.parse(payload)); } catch { /* keep-alive or non-JSON event */ }
      }
      data = [];
    }
  }
  if (data.length) {
    try { messages.push(JSON.parse(data.join('\n'))); } catch { /* ignore */ }
  }
  return messages.at(-1);
}

async function readResponse(response) {
  const text = await response.text();
  if (!text) return {};
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('text/event-stream')) return parseSse(text) ?? {};
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

export class McpClient {
  constructor({ url = DEFAULT_URL, token, fetchImpl = globalThis.fetch } = {}) {
    this.url = url;
    this.token = token;
    this.fetch = fetchImpl;
    this.requestId = 0;
    this.sessionId = undefined;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    const result = await this.request('initialize', {
      protocolVersion: '2025-03-26',
      capabilities: {},
      clientInfo: { name: CLIENT_NAME, version: CLIENT_VERSION }
    }, { initialize: true });
    if (result?.error) throw this.rpcError(result.error);
    await this.notify('notifications/initialized');
    this.initialized = true;
  }

  async notify(method, params = {}) {
    const headers = this.headers();
    headers.set('Accept', 'application/json, text/event-stream');
    const response = await this.fetch(this.url, {
      method: 'POST', headers, body: JSON.stringify({ jsonrpc: '2.0', method, params })
    });
    if (!response.ok && response.status !== 202) throw await this.httpError(response);
  }

  async request(method, params = {}, { initialize = false } = {}) {
    const id = ++this.requestId;
    const headers = this.headers();
    headers.set('Accept', 'application/json, text/event-stream');
    const response = await this.fetch(this.url, {
      method: 'POST', headers, body: JSON.stringify({ jsonrpc: '2.0', id, method, params })
    });
    if (initialize) this.sessionId = response.headers.get('mcp-session-id') ?? undefined;
    if (!response.ok) throw await this.httpError(response);
    const payload = await readResponse(response);
    if (payload?.id !== undefined && payload.id !== id && !payload?.result) {
      throw new MobbinError(`Unexpected MCP response id: ${payload.id}`);
    }
    return payload;
  }

  async callTool(name, arguments_ = {}) {
    await this.initialize();
    const response = await this.request('tools/call', { name, arguments: arguments_ });
    if (response?.error) throw this.rpcError(response.error);
    return response?.result ?? response;
  }

  headers() {
    const headers = new Headers({ 'Content-Type': 'application/json' });
    if (this.token) headers.set('Authorization', `Bearer ${this.token}`);
    if (this.sessionId) headers.set('Mcp-Session-Id', this.sessionId);
    return headers;
  }

  async httpError(response) {
    const payload = await readResponse(response);
    const detail = payload?.message || payload?.error?.message || payload?.error || payload?.raw;
    const suffix = response.status === 401 ? ' Run `mobbin auth login` or set MOBBIN_TOKEN.' : '';
    return new MobbinError(`Mobbin request failed (${response.status})${detail ? `: ${detail}` : ''}.${suffix}`, { status: response.status });
  }

  rpcError(error) {
    return new MobbinError(error?.message || 'Mobbin MCP request failed');
  }
}

export function extractToolPayload(result) {
  if (result?.structuredContent !== undefined) return result.structuredContent;
  const text = result?.content?.find((item) => item.type === 'text')?.text;
  if (text === undefined) return result;
  try { return JSON.parse(text); } catch { return text; }
}

export { CLIENT_NAME, CLIENT_VERSION, DEFAULT_URL };
