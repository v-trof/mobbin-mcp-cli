# Repository agent instructions

## npm package workflow

- Check registry authentication with `npm whoami` before staging or publishing.
- If `npm whoami` is not authenticated, run interactive `npm login` and wait for the user to complete any browser, password, or two-factor prompts. Never read, print, or commit npm tokens or passwords.
- Always stage packages with npm's staging workflow. Use `npm stage publish . --access public` for this public package; do not use direct `npm publish` as a fallback.
- After staging, use `npm stage list <package-name>` and `npm stage view <stage-id>` to record the staged package and verify its contents. Use `npm stage approve <stage-id>` only when publication is explicitly requested and the staged package is confirmed.
- If staging fails because the package is not registered or the account lacks permission, report the exact registry error and stop. Do not silently switch to direct publishing.
- After a successful package update, refresh the local global installation with `npm install --global .` and verify it with `npm list --global mobbin-mcp-cli --depth=0`.

## Safety

- Run the test suite and package checks before staging.
- Never expose or commit bearer tokens, npm credentials, one-time passwords, or other secrets.
