# Mobbin CLI

`mobbin` is a small command-line client for Mobbin's official hosted MCP server. It exposes Mobbin's searchable UI screens, multi-step flows, and website sections to terminals, scripts, and design-oriented agents.

Mobbin's MCP server is remote; there is no local server package to install. The CLI uses Streamable HTTP and the same OAuth authorization flow as supported MCP clients.

## Install

```sh
npm install -g mobbin-mcp-cli
```

To install a checkout directly:

```sh
npm install -g .
```

## Configure

```sh
mobbin auth login
mobbin auth status
```

`auth login` opens Mobbin's OAuth page, waits for the local callback, and stores credentials in the per-user config directory. Mobbin MCP access requires a Pro, Team, or Enterprise plan.

For CI or an already-issued bearer token:

```powershell
$env:MOBBIN_TOKEN = "your-token"
```

`MOBBIN_TOKEN` and `--token` take precedence over saved credentials. Use `mobbin auth logout` to remove saved credentials. Override the endpoint with `MOBBIN_MCP_URL` for testing or a compatible proxy.

## Examples

```sh
mobbin skill > SKILL.md
mobbin search screens "mobile banking onboarding with identity verification"
mobbin search screens "dark analytics dashboard" --platform web --json
mobbin search flows "subscription checkout with trial" --platform ios
mobbin search sections "SaaS pricing page with annual toggle" --json
mobbin call search_screens --args '{"query":"calendar empty state"}' --json
```

Searches default to the server's text response. Add `--json` for scripts and pipelines. Include platform or app context in the natural-language query; `--platform` and `--app` are also forwarded when the server supports those filters.

## Agent skill

`mobbin skill` prints the bundled `mobbin-design` skill. It teaches an agent to research multiple Mobbin references, lock a distinct direction, and validate implementation against that research before substantial design work.

## Development

```sh
npm test
npm start -- search screens "developer tool onboarding" --json
```

The package uses Node's built-in `fetch`, HTTP server, crypto, and test runner, so it has no runtime dependencies.

## Notes

This project is a client for Mobbin's official MCP endpoint. It does not mirror Mobbin's catalog, bypass authentication, or redistribute screenshots. See [Mobbin MCP documentation](https://docs.mobbin.com/mcp/introduction) for service availability and authorization details.

## License

MIT
