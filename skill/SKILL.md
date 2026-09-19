---
name: mobbin-design
description: "Research-first design guidance using Mobbin's real-world screens, flows, and website sections. Use before making substantial visual, UI-pattern, or journey decisions."
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
| Call a newly added/advanced tool | any tool name | `mobbin call <tool> --args '{...}'` |

Useful search options are `--limit`, `--page`, `--mode` (screens), repeated `--exclude-screen-id` (screens), `--image-format webp|jpg`, and `--task-intent`. Use `--json` for the complete MCP response. The structured payload uses `screens`, `flows`, or `sections`, with `page` and `has_next_page` for paginated results.

Mobbin returns low-resolution preview images inline and a high-resolution `image_url` in result metadata. Use `image_url` when exporting or embedding a reference; URLs expire after 30 days. Cite each reference with its canonical `mobbin_url`. The CLI preserves inline image blocks in `--json` output, while normal output focuses on structured text.

## Authentication

Run `mobbin auth login` for the browser-based OAuth flow. The CLI discovers Mobbin's protected-resource and authorization-server metadata, registers a public client dynamically, uses PKCE with the `openid` scope, and refreshes credentials when a refresh token is available. For CI, use `MOBBIN_TOKEN` or `mobbin ... --token <token>`. Never commit credentials or print bearer tokens.

## Guardrails

- Use several references and synthesize a distinct result.
- Treat screenshots as evidence for patterns, not as assets to redistribute.
- Preserve the role of important tokens and media treatments when adapting a reference.
- If the search is sparse, broaden the query or use another reference layer instead of inventing unsupported product behavior.
- Respect Mobbin's rate limit and allow the CLI to honor `Retry-After` responses.
