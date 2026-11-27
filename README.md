# Mobbin CLI

`mobbin` is a small command-line client for Mobbin's official hosted MCP server. It exposes Mobbin's searchable UI screens, multi-step flows, and website sections, plus your saved items and collections, to terminals, scripts, and design-oriented agents.

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
mobbin skill install --target claude
mobbin search screens "mobile banking identity verification" --platform ios --limit 10
mobbin search screens "dark analytics dashboard" --platform web --mode standard --image-format jpg --json
mobbin search flows "subscription checkout with trial" --platform ios --page 1
mobbin search sections "SaaS pricing page with annual toggle" --limit 10 --json
mobbin search screens "settings page" --platform web --output-destination code --output-tool React
mobbin collections list
mobbin collections get all-saved --type screens --platform ios --limit 20
mobbin collections get <collection-uuid> --type sections --page 2
mobbin collections create "Checkout references" --description "Payment step ideas"
mobbin save screens <screen-uuid> <screen-uuid> --collection <collection-uuid>
mobbin comment flows <flow-uuid> "Good trial-to-paid handoff"
mobbin tools
mobbin call search_screens --args '{"query":"calendar empty state","platform":"ios"}' --json
```

Screens and flows require `--platform ios|web`. Put the app name in the natural-language query; `--app` is not a current MCP argument. Screens support `--mode`, repeated `--exclude-screen-id`, and `--limit`; flows and sections support `--page` and `--limit`. All three searches support `--image-format webp|jpg`, `--task-intent`, `--output-destination code|design_tool|doc|reference_library|chat|other`, and `--output-tool <product>`. Keep the task intent, destination, and tool the same across every call for one task. Queries are limited to 500 characters.

## Collections, saving, and comments

| Command | MCP tool |
|---|---|
| `mobbin collections list` | `list_collections` |
| `mobbin collections get <id\|all-saved> --type screens\|flows\|sections` | `get_collection_contents` |
| `mobbin collections create <name> [--description TEXT]` | `create_collection` |
| `mobbin save <type> <id>... [--collection ID\|all-saved]` | `save_content` |
| `mobbin comment <type> <id> <text>` | `add_comment` |

- `collections get` fetches one kind per call. Screens and flows need `--platform ios|web`. `--page` is 1-20. `--limit` is 1-30 (flows: 1-10). Keep `--limit` the same on every page.
- `all-saved` holds every save. Use it to find one saved item.
- `save` defaults to `all-saved`. Saving to a collection also saves to All saved. It is all or nothing and safe to repeat. Ids can be space- or comma-separated.
- `comment` posts a new comment on each call. Mobbin adds the app name, so do not sign it. `@mentions` do not notify anyone.
- New collections are private to you and your team.
- Ids must be UUIDs from search results, collection contents, or Mobbin links. Never guess them.
- `list`/`get` accept `--task-intent`, `--output-destination`, `--output-tool`. `create`, `save`, and `comment` accept `--task-intent` only.

## Contract checks

`mobbin tools` lists the tools the server currently exposes (`--json` includes full input/output schemas), which is the quickest way to check for contract changes; `mobbin call` reaches any tool or argument the dedicated commands don't cover yet.

Searches default to the structured text payload. Add `--json` for the complete MCP tool response, including structured results and inline image blocks. Structured results use `screens`, `flows`, or `sections`; paginated responses also include `page` and `has_next_page`. Each result may include an inline low-resolution preview and a high-resolution `image_url`; image URLs expire after 30 days, so download them when exporting and cite the result's `mobbin_url`. When Mobbin includes an `ai_usage_notice` (high AI usage), the CLI also prints its markdown text to stderr after the results; show it to the user verbatim.

## Agent skills

The package bundles four skills. `mobbin skill list` shows them, `mobbin skill <name>` prints one, and `mobbin skill` alone still prints `mobbin-design`.

| Skill | Use |
|---|---|
| `mobbin-design` | Research Mobbin references, lock a distinct direction, and check the build against it. |
| `design-floor` | Rules for any UI edit that models break by default: copy that explains the interface, `title` tooltips and hand-rolled popovers, landing-page layouts inside apps, entrance animations, unstable geometry. |
| `design-redesign` | One screen or component in an existing app: `fix` reworks it in place, `variants` builds three alternatives in the app's own visual world that differ in structure. |
| `design-explore` | Divergent directions with one fresh-context agent per seed and a distinctness gate. Runs only when the user asks for it. |

The skills load each other through the CLI (`mobbin skill design-floor`, `mobbin skill design-redesign --ref fix.md`), so they work wherever `mobbin` is on the PATH, whatever the install location.

Install them into an agent harness:

```sh
mobbin skill install --target claude              # ~/.claude/skills
mobbin skill install --target agents --project    # ./.agents/skills
mobbin skill install design-floor --target codex  # $CODEX_HOME/skills, default ~/.codex/skills
mobbin skill install --dir ./somewhere/skills
```

Pass skill names to install a subset. `design-explore` is marked user-invoked: the `claude` target adds `disable-model-invocation: true` to its frontmatter, and the other targets write `agents/openai.yaml` with `allow_implicit_invocation: false`. Each installed folder gets a `.mobbin-skill.json` marker, and reinstalling replaces marked folders. An existing folder without the marker is left alone unless you pass `--force`.

### Design seeds

`design-explore` draws its directions with `mobbin seeds`, which samples a curated deck in code. Asked for distinct directions, models keep landing on the same few looks. Each direction gets a structure, an interaction model, a source world from outside software, a density, a colour strategy and a type voice. No two directions in one draw share a structure or a world, and when three or more are drawn, the last also gets a wild twist.

```sh
mobbin seeds --count 4
mobbin seeds --count 4 --seed 482113 --json         # reproduce a draw
mobbin seeds --count 1 --avoid ledger,blueprint     # redraw while excluding used options
```

The deck lives in [seeds/deck.json](seeds/deck.json).

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
