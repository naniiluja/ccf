# Changelog

## 0.19.4

Rem docks again after `/clear` and `/new`: `session.start` now resets `hasTriedDock` (it stayed true from the first dock, so no automatic dock ever ran in the new session) and tries twice, at 2s and 5s, and the first prompt-area render that reports a fullscreen layout docks her at once, so a new session no longer waits for a timer.

eval: not run: the paid eval harness measures /ccf:check review quality, not UI mods; verified with tsc (TypeScript 5), claude plugin validate and the repo suite, not on a live pane.

## 0.19.3

Rem now faces the way she walks: the base sprite looks left, so it is mirrored only while she moves right (0.19.2 had it backwards). The happy face keeps its eyes but smiles with a small closed mouth instead of a wide grin.

eval: not run: the paid eval harness measures /ccf:check review quality, not UI mods; verified with tsc (TypeScript 5), claude plugin validate and the repo suite, not on a live pane.

## 0.19.2

The "Chưa có task nào" hint now sits under the mascot instead of above her bubble. Rem's walk now looks like a walk: the sprite is mirrored when she turns around, one leg lifts per step and the opposite hand swings (`Pose` and `liftLeg`/`swingArms` in sprite.ts). Fixed two Rems on screen after `/reload-plugins`: the dock pane now sets `ccf/isDocked` whenever it renders, so the copy above the chat box hides at once instead of after the next prompt.

eval: not run: the paid eval harness measures /ccf:check review quality, not UI mods; verified with tsc (TypeScript 5), claude plugin validate and the ui-model unit tests (31/31). The sprite poses were checked by printing the pixel rows, not on a live pane.

## 0.19.1

Rem walks left and right inside the dock pane: every 500ms she takes one cell and turns around at either edge (`walkStep` in lib/ui-model.mjs, `ccf/walk` atom). She stands still when the pane is no wider than the sprite or when she is asleep.

eval: not run: the paid eval harness measures /ccf:check review quality, not UI mods; verified with claude plugin validate and the ui-model unit tests (31/31). Two Jev script tests (finding-verify-script, completion-evidence) fail on a clean main too.

## 0.19.0

Cook now marks wave tasks in-progress in PLAN.md before they start (one PLAN.md commit per wave) and the board refreshes to show it, instead of jumping straight from todo to in-review. Rem's spoken lines are AI-generated at runtime: the template line shows instantly, then Haiku rewrites it via the plugin engine after a short debounce, keeping every fact from the original (task codes, /commands, filenames, numbers); failures keep the template line, and a `remAi` flag turns it off. The dock pane shows "Chưa có task nào. Gõ /ccf:plan nhé." when there is no wave and no board task.

eval: not run: the paid eval harness measures /ccf:check review quality, not the cook orchestrator or UI mods; verified with claude plugin validate, 46/46 plugin tests and the node suite.


## 0.18.0

Jev-gated inline cook: tasks classified by Jev as small and low-risk now run directly in the session instead of an isolated git worktree. plan-waves.mjs emits per-task mode, modeReason and inlineScore; lib/inline-gate.mjs applies hard exclusions first (touches UI, more than 3 files, unparseable paths), then asks Jev, inline at score >= 0.7. Missing key or any Jev failure falls back to a worktree without blocking. Default behavior unchanged. Also in this release: Rem mascot speech is now contextual (lib/rem-lines.mjs), naming the slash command, the running test/build/script, pass/fail counts and cook task progress instead of fixed lines. The band and status lines render below the mascot sprite in the dock pane instead of above the chat frame.

eval: not run: the paid eval harness measures /ccf:check review quality, not the cook orchestrator; verified with claude plugin validate, 30/30 plugin tests and the node suite.


## 0.17.0

Wave map visibility fixes plus a merged dock pane, from TUI feedback on 0.16.1:

- loadWavesFromRun toasts the placement reason with a /ccf-waves hint when the wave pane cannot be placed, instead of failing silently.
- The "wave map is off" toast also fires from tool.call when the orchestrator runs plan-waves.mjs while uiWaves is off (once per session).
- waveRows reads PLAN.md snapshot state: tasks in in-review/done render done even when no agent was recorded.
- The rem dock pane now renders board summary + wave region + Rem in one column (40 cols when uiBoard/uiWaves on); the wave map updates via atoms, no separate $.ui.open, so the 144-column unasked-pane threshold no longer hides it.
- Wave region scrolls independently (ccf/wavesOffset atom + ui.scroll hook), board and Rem stay put.
- truncate-end wrap on task/board lines, ".." markers with hidden counts at the visible wave window edges.

eval: not run: the paid eval harness measures /ccf:check review quality, not UI mods; verified with claude plugin validate, 30/30 plugin tests and the node suite.


## 0.16.1

Fix wave map timing and the silent-off UX from 0.16.0: the wave map no longer loads at /ccf:cook submit time (when the session cwd has no PLAN.md yet); instead the mod hooks tool.call, catches the orchestrator's own plan-waves.mjs run and parses that call's JSON stdout, so the map uses the right task list, dir and timing. /ccf-waves reloads the wave when invoked. Running /ccf:cook with uiWaves off now shows an 8-second toast pointing at the userConfig flag (once per session).

eval: not run: small bug-fix follow-up to 0.16.0, verified by plugin tests and node tests.

## 0.16.0

Add rem-mascot pixel-art mascot and an opt-in CCF UI layer via Claude Code mods: /rem toggles Rem with mood-based expressions (idle/thinking/happy/worried/sleepy/surprised, kaomoji on desktop); userConfig flags uiBand (active PLAN.md task above the prompt), uiBoard (/ccf-board kanban from PLAN.md + PENDING.md risks), uiWaves (/ccf-waves worktree agent map from plan-waves.mjs), uiStatusLine (spec freshness + CLAUDE.md budget). UI reads existing data sources only, pane buttons only prefill commands, and a failing mod never breaks CCF's deterministic gates.

eval: not run: the paid eval harness measures /ccf:check review quality, not UI mods; this feature was verified with claude plugin validate, 14/14 plugin tests and the node suite.

## 0.15.1

| case | pass | mean score | cost |
| --- | --- | --- | --- |
| 01-missing-criterion | 3/3 | 1.00 | $1.43 |
| 02-boundary-error | 3/3 | 1.00 | $1.34 |
| 03-scope-creep | 0/3 | 0.75 | $1.27 |
| 04-rule-violation | 3/3 | 1.00 | $1.45 |
| 05-swallowed-error | 3/3 | 1.00 | $1.40 |
| 06-clean-diff | 3/3 | 1.00 | $1.25 |
| 07-scope-only | 0/3 | 0.50 | $1.32 |
| 08-permitted-pattern | 3/3 | 1.00 | $1.22 |
| 09-unruled-bug | 0/3 | 0.75 | $1.37 |

Run 2026-10-04T14-58-58-440Z (claude 2.1.289, 9 cases x 3 runs, 2200s, $12.06, not partial). Case 08 passes 3/3 (`all-refuted`) on real checker output, which confirms the grader fix that had only been verified offline. With a working Bash sandbox, cases 03, 07 and 09 have valid numbers for the first time: 03 `found-defect` 0/3, 07 `found-defect` and `attributed-to-scope` 0/3, 09 `reproduced-bug` 3/3 but `found-defect` 0/3.

## 0.15.0

eval: not run: no paid claude plugin eval run on 0.15.0; newest results cover 7 of 9 cases

## 0.14.0

eval: not run: no paid claude plugin eval run on 0.14.0; the newest evals/results run (2026-10-02T02-42-07-846Z, plugin 0.13.3) covers 7 of the 9 current cases (missing 08-permitted-pattern, 09-unruled-bug) and every run errored before starting because that host could not create a shell sandbox
