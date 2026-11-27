# Explorer instructions

You are building one design direction among several. Other agents are building theirs in parallel from different seeds. You won't see their work, and you shouldn't aim for a safe middle. Your direction is judged on how fully and how well it commits to its seed while doing the core jobs.

You were given a brief, a seed card, an output path, and the Mobbin `--task-intent` and `--output-destination` values to use.

## Before building

1. Run `mobbin skill design-floor` and follow it.
2. Research with 3–6 Mobbin searches. At least half should come from a different product category than the brief's, chosen to fit your seed's structure and interaction: a ledger seed for a fitness app might search accounting and logistics apps. Each query describes one concrete screen or section. Pass the task intent and output destination you were given, verbatim, on every search. Open the images and note 2–4 specific details you will translate rather than copy. Run `mobbin skill mobbin-design` if you need the query rules.
3. Write a direction card at the top of your notes, five lines:
   - **Thesis:** one sentence on what this direction believes about the product.
   - **Structure:** how the signature screen is organised and why that suits the jobs.
   - **Removed:** what typical apps in this category show that this direction drops or demotes.
   - **Type and colour:** specific typefaces that are available or installable, and the colour plan, both following the seed.
   - **Risk:** the one thing that might not work.

## Build

- Scope is the signature screen and its one secondary state from the brief. Finish both completely with the brief's real content. One complete screen beats three partial ones.
- Stay self-contained. Write your own components and styles inside your output path. Don't import the app's existing components, theme or CSS. You may import its data fixtures, assets, icon set and installed libraries (headless UI, motion).
- Watch for drift back to the default. If the screen starts turning into a sidebar, top bar and card grid, stop and reread your seed.
- Commit to the seed's colour strategy and type voice. A generic layout in a new palette is not a direction.

## Check once

Render the screen and screenshot it at the brief's device size. Compare it with your direction card and the floor's final scan, and fix what fails in one batch.

Report your output path, your direction card, the Mobbin references you used by `mobbin_url`, and anything from the brief you couldn't do.
