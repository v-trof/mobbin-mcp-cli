---
name: design-redesign
description: "Redesign one screen or component inside an existing app codebase. Fix mode reworks it in place; variants mode builds three alternatives that keep the app's visual world but differ in structure. Use when the user says a specific screen or component looks bad, asks to make it better, or asks for options for it. Not for new products or whole-app redesigns."
---

# Redesign a screen or component

Two modes share one setup:

- **fix** makes the target better in place and produces one result. It is the default.
- **variants** builds three alternatives to compare. Use it when the user asks for options, alternatives, or a few ideas.

## Setup

1. **Scope.** Name the exact screen or component and its files. Everything outside it stays unchanged. If the work needs a shared component changed, say so, and either change it only for this usage or ask first.
2. **Floor.** Run `mobbin skill design-floor` and follow it.
3. **Baseline.** Run the app and screenshot the target at its real size with realistic data: the project's seed or fixture data, or a populated state you create. Also capture the extremes it will meet: the longest real name, empty, many items. The code alone doesn't show what is wrong.
4. **Incumbent system.** Find what the app already uses: tokens or theme, component library, icon set, typefaces, spacing scale. A redesign of one screen keeps all of it. It may add a missing piece, such as a tooltip primitive, through the same library.
5. **Diagnosis.** Before editing, write a ranked list of what is wrong with this screen, one line each: hierarchy (what should lead doesn't), density, alignment, missing states, copy, floor violations. This list is the work; don't restyle what isn't on it.
6. **Evidence.** Run 1–3 Mobbin searches for the same screen or component type on the same platform in well-made products. Look at structure, priorities and states, not style. `mobbin skill mobbin-design` has the query rules.

Then load the mode: `mobbin skill design-redesign --ref fix.md` or `mobbin skill design-redesign --ref variants.md`.
