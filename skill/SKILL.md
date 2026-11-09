---
name: mobbin-design
description: "Research-first design guidance using Mobbin's real-world screens, flows, and website sections, plus the user's saved Mobbin collections. Use before making substantial visual, UI-pattern, or journey decisions, or when the user mentions their Mobbin saves or collections."
---

# Mobbin Design Research Skill

Use Mobbin as evidence before substantial design work. Search the relevant reference layer, inspect several results, and synthesize a direction adapted to the product rather than copying one reference.

## Research layers

- **Screens** — concrete UI patterns, hierarchy, components, copy, states, and product details.
- **Flows** — multi-step journeys such as onboarding, checkout, signup, and cancellation.
- **Sections** — website sections such as heroes, pricing blocks, testimonials, and footers.

## Workflow

1. Write a short brief: audience, user goal, platform, desired tone, constraints, and the decision to make.
2. Search the most relevant layer with a specific natural-language query. For screens and flows, pass the required `--platform ios` or `--platform web`; do not pass platform as prose. Include product category or state in the query when useful, and name a specific app in the query when filtering to that app.
3. Review multiple strong results and identify shared patterns plus one distinctive direction.
4. Lock a direction before implementation: preserve the chosen traits, define what is borrowed, and record why each major decision fits the brief.
5. Build the design without cloning a single source.
6. Compare the result against the locked direction and correct visible or interaction drift.

## CLI command map

| Research operation | MCP tool | CLI command |
|---|---|---|
| Search UI screens | `search_screens` | `mobbin search screens "..."` |
| Search user flows | `search_flows` | `mobbin search flows "..."` |
| Search website sections | `search_sections` | `mobbin search sections "..."` |
| List saved items and collections | `list_collections` | `mobbin collections list` |
| Read a collection or all saves | `get_collection_contents` | `mobbin collections get <id\|all-saved> --type screens\|flows\|sections [--platform ios\|web]` |
| Create a collection | `create_collection` | `mobbin collections create "<name>" [--description "..."]` |
| Save items | `save_content` | `mobbin save <screens\|flows\|sections> <id>... [--collection <id>]` |
| Comment on an item | `add_comment` | `mobbin comment <screens\|flows\|sections> <id> "<text>"` |
| List server tools and schemas | `tools/list` | `mobbin tools --json` |
| Call a newly added/advanced tool | any tool name | `mobbin call <tool> --args '{...}'` |

Useful search options are `--limit`, `--page`, `--mode` (screens), repeated `--exclude-screen-id` (screens), `--image-format webp|jpg`, `--task-intent`, `--output-destination`, and `--output-tool`. As a coding agent working in a repository, pass `--output-destination code` (use `design_tool` with `--output-tool Figma` etc. when results go onto a design canvas, `doc` for reports/specs). Keep `--task-intent`, `--output-destination`, and `--output-tool` identical across all searches for the same task, write the intent in English, and never include user messages or personal data in it. Queries describe one screen, flow, or section (max 500 characters), without negations or vague style words. Use `--json` for the complete MCP response. The structured payload uses `screens`, `flows`, or `sections`, with `page` and `has_next_page` for paginated results.

Mobbin returns low-resolution preview images inline and a high-resolution `image_url` in result metadata. Use `image_url` when exporting or embedding a reference; URLs expire after 30 days. Cite each reference with its canonical `mobbin_url`. If a response includes `ai_usage_notice` (also printed to stderr), show its `text` to the user word for word as its own block after the results. The CLI preserves inline image blocks in `--json` output, while normal output focuses on structured text.

## Saved items and collections

- When the user refers to their saves or a collection by name, run `mobbin collections list` first. A count of zero means nothing to fetch. Tell the user.
- Collection names are not unique. If two match, ask the user which one, using `updated_at` or contents.
- To find one saved item, read `all-saved`. It holds every save.
- `collections get` reads one kind per call. Read in full up to 100 screens/sections or 30 flows. Above that, give the count, read 3 pages, and ask what to look for. Max 20 pages. Keep `--limit` fixed across pages.
- Read each item's `comments`. They hold the team's notes. Use `screen_patterns`, `ui_elements`, `section_patterns`, `actions`, `app_name`, and `site_name` to filter.
- Write only when the user asks: `save`, `comment`, `collections create`. Never save to remember results for yourself.
- Use ids from tool results or Mobbin links only. Never guess an id.
- `save` is all or nothing and safe to repeat. `comment` posts a new comment each call, so send each note once. Do not sign comments. `@mentions` do not notify anyone. Tell the user before you post one.
- New and private collections open only for the user and their teammates. Say so when you share a link.

## Authentication

Run `mobbin auth login` for the browser-based OAuth flow. The CLI discovers Mobbin's protected-resource and authorization-server metadata, registers a public client dynamically, uses PKCE with the `openid` scope, and refreshes credentials when a refresh token is available. For CI, use `MOBBIN_TOKEN` or `mobbin ... --token <token>`. Never commit credentials or print bearer tokens.

## Guardrails

- Use several references and synthesize a distinct result.
- Treat screenshots as evidence for patterns, not as assets to redistribute.
- Preserve the role of important tokens and media treatments when adapting a reference.
- If the search is sparse, broaden the query or use another reference layer instead of inventing unsupported product behavior.
- Respect Mobbin's rate limit and allow the CLI to honor `Retry-After` responses.
