---
paths:
  - "plugins/ccf/hooks/register.tsx"
  - "plugins/ccf/hooks/sprite.ts"
  - "plugins/ccf/hooks/ui/**"
  - "plugins/ccf/hooks/lib/ui-model.mjs"
  - "plugins/ccf/hooks/lib/ui-snapshot.mjs"
  - "plugins/ccf/hooks/lib/rem-lines.mjs"
  - "plugins/ccf/tests/**"
  - "plugins/ccf/types/**"
---

# UI mod (function-hooks module: Rem dock + CCF UI layer)

Lazy rule: deliberately NOT `@import`ed from `CLAUDE.md`, so it costs nothing until a file above is touched.

## What it is
- `hooks/hooks.json` declares `"modules": ["./register.tsx"]` next to `"hooks"`. That loads a Claude Code function-hooks module (early access API, see the `plugin-authoring` skill), a SEPARATE artifact from the 7 `.mjs` command hooks.
- Entry `hooks/register.tsx` (Rem mascot, dock pane `rem`, walk, mood, voice) imports `hooks/sprite.ts` (pixel art), `hooks/ui/ccf-ui.mjs` (band, board, wave map) and the pure libs `hooks/lib/ui-model.mjs`, `hooks/lib/rem-lines.mjs`. `$.state` atoms are typed in `types/index.d.ts`, which `plugin.json` names in `"types"`.
- `plugin.json` `userConfig` toggles it: `uiBand`, `uiBoard`, `uiWaves`, `uiStatusLine` default `false`; `remAi` defaults `true` and makes one Claude Haiku 4.5 call on the user's account per notable event. That default is the one CCF network call that is not opt-in.

## Rules
- The mod is run by the Claude Code mod engine, not by `node`: `.ts`/`.tsx` is allowed here and only here, and `import ... from 'claude-code'` is the engine's module, not an npm dependency. The `.mjs`-only, no-dependency invariant of `hooks.md` still binds every command hook and every `hooks/lib/*.mjs`.
- The mod sandbox has no Node. Anything needing `node:fs` runs as a CLI through `$.process.run` (`node hooks/lib/ui-snapshot.mjs`, `scripts/plan-waves.mjs`, `scripts/spec-budget.mjs`) and the mod draws its JSON.
- The mod only READS what CCF already keeps (`PLAN.md`, `PENDING.md`, script output). It writes no file and decides no gate, so every `.mjs` hook behaves the same with the UI on or off.
- Decision logic goes in a pure `hooks/lib/*.mjs` with a `node --test` file (`ui-model`, `ui-snapshot`, `rem-lines`); `register.tsx`/`ccf-ui.mjs` stay rendering and wiring.
- Draw progress with `Raster` on the terminal and `Svg` on desktop (no `Raster` there).

## Verify
- `claude plugin test` from `plugins/ccf` runs `tests/*.test.tsx` (`claude-code/testing`). `claude plugin validate plugins/ccf` after any `plugin.json`/`hooks.json` edit.
- The repo `tsc` does NOT check the mod: `tsconfig.json` includes `.mjs` only and excludes `hooks/ui/**`. No repo command type-checks `register.tsx`/`sprite.ts` yet; say so instead of claiming they are type-checked.
- README pins the build the API was tested on; re-run both commands on a newer Claude Code before trusting it.
