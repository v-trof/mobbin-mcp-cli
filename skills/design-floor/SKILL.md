---
name: design-floor
description: "Rules for product UI that models break by default: copy that explains the interface, title-attribute tooltips and hand-rolled popovers, landing-page layouts inside apps, card-everything, entrance animations, layout that shifts on hover or load. Use whenever writing or editing app UI, including screens, components, styles, and UI copy."
---

# Design floor

These rules cover what generated UI gets wrong when nobody asks. Basics such as contrast and semantic HTML are left out on purpose. The user's words and the project's own design system override anything here.

Apply the rules while building, then do the final scan once at the end.

## Copy

- Don't explain the interface inside the interface. No "Click a row to edit", "Drag cards to reorder", "Use the filters above to narrow results". If a screen needs instructions, its affordances are wrong; fix those. Teaching belongs in a first-run empty state and nowhere else.
- No subtitle that restates its heading ("Settings: manage your settings"). The navigation already says where the user is; most screens need a title and nothing under it.
- No marketing voice inside the product: no "Supercharge", "Unlock", "seamless", no welcome banner across the top of a work screen, no sparkle "AI-powered" chips.
- Name things the way the user knows them, not how the system stores them ("Notifications", not "Webhook config").
- A button says what happens ("Archive 3 invoices") and the result confirms it ("Archived"). No "Submit", "OK", "Proceed".

## Components

- Floating UI comes from the project's headless library: tooltips, popovers, dropdown menus, selects, comboboxes, dialogs, sheets, toasts. Check the dependencies first (Radix, React Aria, Base UI, Ark, Headless UI, Floating UI, Sonner, shadcn/ui wrappers, or the platform's native components). If none is installed, install one. Never write positioning, collision handling, portals, focus traps or dismiss logic yourself.
- Never use the `title` attribute as a tooltip. It is slow, unstyled, and missing on touch.
- Tooltips open after about 400 ms and instantly when the pointer moves to a neighbour (the library's provider or skip delay). Use them on icon-only buttons, paired with an accessible label, and on truncated text to show the full value. Never put information the user needs only in a tooltip, and don't add one to a control that already has a visible label.
- No `alert`, `confirm` or `prompt`. For a reversible destructive action, do it and offer Undo in a toast. Confirm only irreversible actions, in an in-app dialog that names the object ("Delete 'Q3 report'?") and labels its button with the action.
- One icon set at one stroke weight, sized to the adjacent text. No emoji standing in for icons, and no icon on every button and heading.
- Relative times ("3 h ago") show the absolute time on hover and focus.

## Layout

- An app screen is not a landing page. No hero, no centred column of text, no large H1 with a paragraph under it, no full-viewport sections. Content aligns to a left edge and starts near the top.
- Density follows the task. Operating surfaces (tables, lists, inboxes, editors) use compact rows of about 32–40 px on desktop, small headings and tight gaps. Generous spacing is for reading surfaces.
- Not everything is a card. A card marks one separable object. No card inside a card, no identical rounded, shadowed box around every section, no bento grid without a reason. No row of big-number tiles unless those numbers are the job of the screen.
- Geometry stays put:
  - Hover, selected and active states don't change size. No bold-on-hover; reserve borders as transparent instead of adding them on hover.
  - A button keeps its width while it shows a spinner or "Saving…".
  - Loading skeletons match the final layout, and async content has its space reserved.
  - Digits that change or line up in columns use tabular figures.
- Build for real content: the longest real name, 0, 1 and 1,000 items, missing avatars and images. Truncate with an ellipsis and a way to see the full value; give flex and grid children that hold text `min-width: 0`.
- Radius comes from one small scale. A nested element's radius is the parent's radius minus the padding between them, or square.
- One scroll container per region. Table headers stay sticky. Don't nest scroll areas.

## Interaction and motion

- No entrance animations on app screens: no staggered fade-up of cards on every load, no numbers counting up, no animated gradients behind content. Motion marks a change of state: open, close, insert, remove, reorder.
- Keep it short: 120–250 ms, ease-out to enter, faster to exit. No springs or bounce on utility UI.
- Nothing essential is hover-only. Row actions revealed on hover also need a visible path on touch and keyboard, such as a menu button or selection.
- Pending work shows where it happens. The clicked control shows progress and blocks a double submit. Safe actions update optimistically. A failed request keeps the user's input.
- Fields have visible labels, never a placeholder as the only label. Validate on blur or submit, not on every keystroke, and put the error next to the field.

## Visual

- Unless the user asks for them, avoid the looks that mark generated UI: purple-to-blue gradients, gradient text, glassmorphism, coloured glows, near-black with a single acid accent, warm cream with a serif and terracotta, an accent stripe down the side of rounded cards.
- The brand colour marks the primary action and the current selection. It is not for every badge, icon and heading. Status colours (success, warning, danger) are separate from it and always come with a word or an icon.
- Shadows mean elevation (menus, dialogs, dragged items). Flat content doesn't get them.
- Dark mode is designed, not inverted: higher layers are lighter, saturated colours are toned down, and borders do more of the separating than shadows.

## Final scan

Before calling a UI change done, screenshot the rendered screen at its real size once and check:

1. Does any sentence explain how to use the screen? Remove it and fix the affordance.
2. Is there a `title` tooltip, a hand-rolled popover, menu or dialog, or an `alert`/`confirm`?
3. Does anything change size on hover or while loading?
4. Does it hold up with the longest real name and with zero items?
5. Does it read as a landing page or a template dashboard?

Fix everything that fails in one batch.
