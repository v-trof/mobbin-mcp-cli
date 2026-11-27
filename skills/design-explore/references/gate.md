# Distinctness gate

Look at all the directions together, at the same size, in both states.

For each pair:

1. **Palette swap.** If you swapped their colours and typefaces, could you still tell them apart? If not, one is a reskin of the other. Rebuild the weaker one with a new structure.
2. **Skeleton.** Do they share a layout skeleton, such as sidebar, header and card grid, or list with a detail pane? Two directions may share one only when their interaction models are clearly different on screen.
3. **Inventory.** The same widgets in the same places with different styling is a fail.

For each direction alone:

4. **Seed fidelity.** Can you recognise its structure, world and colour strategy from the screenshot without reading its card? If not, it drifted.
5. **Default look.** Does it land on a look that marks generated UI: the looks in the floor's Visual section, or brutalist, Swiss poster, editorial broadsheet or terminal green used by default? It fails unless its seed asked for that look.
6. **Jobs.** Can every core job in the brief start from this screen? A wild direction may make a job unusual, never impossible.
7. **Craft.** Floor violations, broken layout, placeholder content. Fix these directly; they don't need a rebuild.

A direction that fails checks 1–6 is rebuilt once: a fresh explorer with the same brief and a new draw for the failing axis (`mobbin seeds --count 1 --avoid <ids already used> --json`). If the rebuild fails too, present it anyway and say which check it failed.
