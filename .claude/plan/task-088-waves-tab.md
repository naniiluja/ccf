# Task 088 — Press a wave row in Rem's dock to open a Waves tab

- **Vertical slice:** pure lib `ui-model.mjs` (`waveSummary`) + UI layer `ccf-ui.mjs` (pressable wave rows, Waves tab rows) + mod `register.tsx` (second pane `waves`) + mod tests + README/CHANGELOG/version sync
- **Depends on:** —
- **Spec refs:** `.claude/rules/ui-mod.md` (mod rules: read-only, pure logic in `hooks/lib/*.mjs`, `Raster` on terminal only); `.claude/rules/coding-conventions.md` (no comments in new code); `.claude/rules/git-workflow.md` (version in 3 places); engine typings `plugin-authoring/types/claude-code.d.ts` on Claude Code 2.1.289 (`PaneOpenArgs`, `Pane.title`: "with more than one pane open the engine draws a tab strip, one shown, the rest tabs"; `ButtonProps`: `onPress`, `key`, `plain`, `dimColor`; `Pane.scroll` is engine-owned).
- **MCP to use:** none
- **Gate (must be GREEN before the next slice):** `node --test plugins/ccf/hooks/lib/ui-model.test.mjs plugins/ccf/hooks/lib/ui-snapshot.test.mjs plugins/ccf/hooks/lib/rem-lines.test.mjs`; `cd plugins/ccf && claude plugin test .` (mod, 39 today); `claude plugin validate plugins/ccf`; `node --test .claude/tests/*.test.mjs` (needs a CHANGELOG entry for the new version). The two Jev cases already red on `main` (PENDING.md A5) are out of scope.
- **Touches UI:** yes
- **Runtime evidence:**

## Goal (one sentence)
In Rem's dock, pressing any wave row of the `/ccf:cook` wave map opens (or shows) a second pane `waves` that the engine draws as a tab beside Rem, holding the full wave map.

## Acceptance criteria (verifiable)
- [ ] `waveSummary(rows)` (pure, `ui-model.mjs`) returns `{ waves: [{ title, total, done }], counts: { done, running, waiting } }` from `waveRows` output; an empty input gives zero counts and no waves.
- [ ] In pane `rem` (dock placement, `uiWaves` on, at least one wave), every wave row drawn by `dockWaveRows` is a `Button` (`plain`, `key` `wave-line-<N>`, `dimColor` for a done task), keeps its `..+N` hidden mark, and its `onPress` calls `$.ui.open({ id: 'waves', title: 'Waves' })`.
- [ ] Pane `waves` (`on('ui.render', { component: 'Pane', requestId: 'waves' })`) on the terminal draws, top to bottom: a summary line `N wave · X xong · Y đang chạy · Z chờ` with a `Raster` progress bar from `progressCells`; per wave a bold `ACCENT` heading `wave K · T task · D xong`; per task one row with the `STATE_GLYPH` glyph, id, title wrapping (not truncated) and a dim state label; a `dockDivider` between waves. It draws every row (the engine scrolls the pane). With no wave it draws one dim line `Chưa có wave nào. Chạy /ccf:cook.`. On a non-terminal surface it draws one `Text` line.
- [ ] Closing pane `waves` does not set `isDismissed` and does not undock Rem (the `ui.close` handler still acts only on `id === 'rem'`).
- [ ] With `uiWaves` off, or no wave, no `Button` is drawn in pane `rem`, so the Waves pane can never be opened; every existing mod test stays green.
- [ ] No new atom and no `types/index.d.ts` change: pane `waves` reads the existing `waves`, `agents` and `snapshot` state.
- [ ] Version bumped to 0.21.0 in `package.json`, `plugins/ccf/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`; `CHANGELOG.md` has a 0.21.0 entry ending with `eval: not run: <reason>`; `plugins/ccf/README.md`'s `uiWaves` row says the rows open a Waves tab.

## Test first (write before implementing)
- `plugins/ccf/hooks/lib/ui-model.test.mjs`: `waveSummary` counts done/running/waiting and per-wave totals; empty input.
- `plugins/ccf/tests/ccf-ui.test.tsx`: (1) dock pane `rem` with 2 waves: `find({ key: 'wave-line-1' })` is a `Button`; pressing it (the test kit's `press` by key) calls `$.ui.open` with `id: 'waves'`. (2) Mount pane `waves`: summary line, both wave headings and a done task are present; with no wave, the empty line. (3) `uiWaves` off: no `Button` in pane `rem`.
- If the test kit cannot press this `Button`, assert its `onPress` exists and call it directly, and say so in the report.

## Files to touch
- `plugins/ccf/hooks/lib/ui-model.mjs` — `waveSummary`
- `plugins/ccf/hooks/lib/ui-model.test.mjs` — its tests
- `plugins/ccf/hooks/ui/ccf-ui.mjs` — `dockWaveRows` takes `openWaves` and draws `Button`; new `wavesTabRows`
- `plugins/ccf/hooks/register.tsx` — `PANE_WAVES = 'waves'`, `dockTree` passes `openWaves`, `ui.render` for pane `waves`
- `plugins/ccf/tests/ccf-ui.test.tsx` — the new mod tests
- `plugins/ccf/README.md` — `uiWaves` row
- `CHANGELOG.md` — 0.21.0 entry
- `package.json` — version
- `plugins/ccf/.claude-plugin/plugin.json` — version
- `.claude-plugin/marketplace.json` — version

## Steps (thin end-to-end slice)
1. Write the failing tests and see them red
2. Implement `waveSummary`, the pressable rows, the Waves pane
3. Run the gate, fill `Runtime evidence`, mark the task `in-review` (NOT `done`)
4. `/ccf:check` → `/ccf:updatespec` — `done` is set ONLY here, after the review passes

## Notes / best-practice sources
- Engine typings, Claude Code 2.1.289: a pane opened by a person's press is placed at any width (an unasked one needs 144 columns); `Button` is the only pressable element; `Box`/`Text` have no `onPress`.
- Unobserved until run live (record in `Runtime evidence`, or the task closes `accepted` with a `PENDING.md` risk row): whether the newly opened pane is the one shown (if not, add `focus: true` to the press-driven open); whether a `plain` `Button` keeps the heading's bold accent; whether the extra tab row still leaves Rem room in the dock; whether opening `waves` changes the dock width (no `columns` passed).
- Out of scope: auto-close when waves end, hotkeys, branch/worktree detail per task, a Board tab, a new `userConfig` flag, a type-check for `.tsx`.
