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

For CI or an already-issued Mobbin MCP bearer token:

```powershell
$env:MOBBIN_TOKEN = "your-access-token"
```

`MOBBIN_TOKEN` and `--token` take precedence over saved OAuth credentials. Use `mobbin auth logout` to remove saved credentials. Override the endpoint with `MOBBIN_MCP_URL` for testing or a compatible proxy. The MCP server uses OAuth access tokens; REST API keys are a separate Mobbin API product and are not used by this CLI.

## Examples

```sh
mobbin skill > SKILL.md
mobbin search screens "mobile banking identity verification" --platform ios --limit 10
mobbin search screens "dark analytics dashboard" --platform web --mode standard --image-format jpg --json
mobbin search flows "subscription checkout with trial" --platform ios --page 1
mobbin search sections "SaaS pricing page with annual toggle" --limit 10 --json
mobbin call search_screens --args '{"query":"calendar empty state","platform":"ios"}' --json
```

Screens and flows require `--platform ios|web`. Put the app name in the natural-language query; `--app` is not a current MCP argument. Screens support `--mode`, repeated `--exclude-screen-id`, and `--limit`; flows and sections support `--page` and `--limit`. All three searches support `--image-format webp|jpg` and `--task-intent`.

Searches default to the structured text payload. Add `--json` for the complete MCP tool response, including structured results and inline image blocks. Structured results use `screens`, `flows`, or `sections`; paginated responses also include `page` and `has_next_page`. Each result may include an inline low-resolution preview and a high-resolution `image_url`; image URLs expire after 30 days, so download them when exporting and cite the result's `mobbin_url`.

## Agent skill

`mobbin skill` prints the bundled `mobbin-design` skill. It teaches an agent to research multiple Mobbin references, lock a distinct direction, and validate implementation against that research before substantial design work.

## Development

```sh
npm test
npm start -- search screens "developer tool onboarding" --platform web --json
```

The package uses Node's built-in `fetch`, HTTP server, crypto, and test runner, so it has no runtime dependencies. HTTP 429 responses are retried using `Retry-After` with bounded exponential backoff.

## Notes

This project is a client for Mobbin's official MCP endpoint. It does not mirror Mobbin's catalog, bypass authentication, or redistribute screenshots. See [Mobbin MCP introduction](https://docs.mobbin.com/mcp/introduction), [features](https://docs.mobbin.com/mcp/features), and [integration guide](https://docs.mobbin.com/mcp/build-an-integration) for the current service contract.

## License

MIT
