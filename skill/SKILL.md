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
2. Search the most relevant layer with a specific natural-language query. Include platform, product category, or state in the query when useful.
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

Add `--json` for scripts and structured inspection. Mobbin returns images and metadata inline in MCP responses; the CLI preserves the server payload for JSON consumers.

## Authentication

Run `mobbin auth login` for the browser-based OAuth flow. Credentials are stored in the per-user config directory and refreshed when a refresh token is available. For CI, use `MOBBIN_TOKEN` or `mobbin ... --token <token>`. Never commit credentials.

## Guardrails

- Use several references and synthesize a distinct result.
- Treat screenshots as evidence for patterns, not as assets to redistribute.
- Preserve the role of important tokens and media treatments when adapting a reference.
- If the search is sparse, broaden the query or use another reference layer instead of inventing unsupported product behavior.
