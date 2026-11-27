# Variants mode

Three variants of the target, compared side by side with the baseline.

**Localized:** every variant uses the app's tokens, type, components, icon set and navigation. Each should look like it shipped in this app.

**Distinct:** each variant takes its own position on at least one structural axis:

- what leads the screen (which job, or which piece of data)
- the layout model: list, table, split pane, board, single focused item, grouped sections
- the editing model: inline, side panel, modal, separate page, direct manipulation
- disclosure: everything visible, or a summary with drill-down
- density

Variants that differ only in colour, spacing, radius, font or shadow don't count. Neither does a variant that mixes the incumbent look with a new one.

## Steps

1. **Theses first.** Before building anything, write the three as one line each, naming their axis positions. For example, "B: the table is the editor. Inline edits, no detail modal, compact rows." Compare them: if two share what leads, the layout model and the editing model, rewrite one. At least one variant should take a position the current screen would never take.
2. **Evidence per variant.** Give each variant 1–2 Mobbin searches that match its thesis, drawn from different products than the other variants. Pass the IDs already used as `--exclude-screen-id` so the variants don't draw on the same screens.
3. **Build.** Each variant is a self-contained copy of the target in its own file or folder, so editing one can't change another. Don't build a shared abstraction across variants. Use the same realistic data in all three. For a large target, when the harness has subagents, build each variant in a fresh-context subagent that gets the diagnosis, the incumbent-system notes, its own thesis and its output path.
4. **Show them together.** Render the baseline and the three variants side by side at the same size with the same data, plus the extremes from setup. Use the repo's convention if it has one (Storybook, a design canvas, a preview route). Otherwise add a dev-only page that renders all four and isn't linked from the product.
5. **After the pick.** If the user combines variants, state the combined decision in one line before building it. Integrate the chosen design into the real target and run the floor's final scan on the result. Then remove the other variants and the comparison page; ask first if the user may want to keep them.

Report the three theses, the side-by-side screenshots, and each variant's Mobbin references by `mobbin_url`.
