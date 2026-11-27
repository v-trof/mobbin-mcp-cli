---
name: design-explore
description: "Generate materially different design directions for a product or screen, with one fresh-context agent per direction seeded from mobbin seeds so the directions don't converge on default AI looks or turn into colour swaps of each other. Use only when the user explicitly asks for exploratory or divergent design directions."
metadata:
  invocation: user
---

# Design exploration

You orchestrate and the explorer agents build. Your work is a clean brief, orthogonal seeds, bounded scopes and a distinctness check. Each step below exists to stop one of three predictable failures:

- **Convergence.** Agents that share context build the same thing. Every explorer starts from a fresh context, and seeds are drawn in code.
- **Laziness.** An agent given a whole app produces shallow, partial screens. Each explorer builds one signature screen and one state.
- **Reuse.** An agent that can import the existing UI rebuilds it with new colours. Explorers may not import the app's components or styles.

## 1. Brief, in text, before code

Write the brief before opening the prototype's source. If a prototype exists, look at screenshots of it only to know the baseline, and don't describe its screens in the brief. If the project already keeps a brief (for example `docs/BRIEF.md`), update that instead of creating another.

- **Product:** what it is and why someone uses it, in 2–3 sentences.
- **People:** who uses it and in what situation (at a desk all day, on a phone between tasks).
- **Core jobs:** 3–6 outcomes as short verb phrases, such as "know which invoices are overdue". List them without scripting each into steps or screens; per-job walkthroughs turn into the same screen inventory in every direction.
- **Content:** real sample data with realistic names, numbers, lengths and images. Use the repo's fixtures or seed data when it has them.
- **Fixed:** platform, device size, and any constraints the user stated.
- **Open:** what this exploration should decide.
- **Signature screen:** the one screen that best expresses the core jobs, plus one secondary state (empty, crowded, detail or in progress). This is each explorer's whole scope.

Show the user the brief in a few lines as you dispatch. Stop and ask only when a fact is missing that you would otherwise have to invent.

## 2. Seeds

Run `mobbin seeds --count 4 --json`; use 3–6 directions. The seeds come from a curated deck sampled in code because models asked for "distinct" directions keep landing on the same few looks: brutalist, Swiss grid, editorial serif, terminal, glass. Note the returned `seed` so the set can be reproduced.

Read each direction's axes against the brief:

- Keep axes that are surprising but workable. Surprise is the point.
- Reroll an axis only when it makes a core job impossible, not when it feels unfamiliar. Run `mobbin seeds --count 1 --avoid <ids already used> --json` and take the replacement for that axis. State each override in one line.
- The world axis is a source of conventions: its units, marks, layout logic and materials. A "departure board" direction borrows fixed columns and status words; it doesn't need fake split-flap animation unless that serves a job.
- The direction marked `wild` carries a twist. It must still do every core job.

Each direction's seed card holds its axes as drawn, your overrides, and nothing else. Don't describe the visual design yourself; that is the explorer's job, and your description would pull every direction toward your taste.

## 3. Dispatch

Start one explorer per direction, each in a fresh context: a new subagent, never a fork of this conversation. Run them in parallel when the harness allows.

Each explorer gets exactly:

- the brief
- its own seed card
- its output path
- the explorer instructions from `mobbin skill design-explore --ref explorer-brief.md`
- the `--task-intent` and `--output-destination` values to pass to Mobbin, written out verbatim and identical for every explorer, since Mobbin expects them to stay the same across one task

An explorer never gets the other seeds, the other explorers' output, the prototype's source, this conversation, or your opinions about the look.

For output, follow the repo's convention for design comparisons if it has one (a design canvas, Storybook, a dev-only route). Otherwise use `design-explorations/<topic>/<letter>-<slug>/`, one self-contained entry per direction, plus an index page that renders all of them side by side at the same size.

**Without subagents:** build the directions yourself, one at a time. Before each, reread only the brief and that direction's seed card. Don't open the earlier directions' files until every direction is built.

## 4. Distinctness gate

When the explorers finish, screenshot every direction at the same device size in its signature screen and its secondary state, and look at them together. Apply `mobbin skill design-explore --ref gate.md`. A failing direction is rebuilt once at most.

## 5. Present

Show the directions side by side at real size, each with its thesis and seed axes. Show each one with the content extremes from the brief (the longest name, empty, crowded) so none is judged on its most flattering frame. Report craft, usefulness and distinctiveness separately. Then ask the user to pick or combine.

After the pick, record only the decision in the project's decisions doc (for example `docs/DIRECTION.md`). Keep the explored directions as history. Further refinement holds the chosen decisions fixed and varies what is still open; `design-redesign` in variants mode does that.
