# Task 095 — Compatibility audit 2.1.284 to 2.1.303, spec sync, version 0.25.0

- **Vertical slice:** rules + README + CHANGELOG + the three version fields + CLAUDE.md counts + the paid-context label
- **Depends on:** 090, 091, 092, 093, 094
- **Spec refs:** `.claude/rules/git-workflow.md` (version synced in 3 places); `.claude/rules/testing.md` (context-budget check); `.claude/tests/changelog.test.mjs`.
- **MCP to use:** none
- **Gate (must be GREEN before the next slice):** all suites, `npx -p typescript tsc --noEmit`, `claude plugin validate plugins/ccf`, `wc -lc CLAUDE.md .claude/rules/*.md`
- **Touches UI:** no
- **Runtime evidence:** not run: documentation and version sync

## Goal (one sentence)
The spec states what is now true (13 scripts, the new preflight problems, the cleanup behavior, the root cause of sequential waves, the Claude Code 2.1.284 to 2.1.303 facts) and the plugin is at 0.25.0.

## Acceptance criteria (verifiable)
- [ ] `package.json`, `plugin.json` and `marketplace.json` read 0.25.0 and `CHANGELOG.md` has a 0.25.0 entry ending in `eval: not run: <reason>`.
- [ ] `tooling.md` documents `plan-lint.mjs` and the new preflight problems and cleanup fields; `architecture.md`, `CLAUDE.md` and `README.md` say 13 scripts.
- [ ] The audit facts are written once, with versions: auto mode default (2.1.284), `UserPromptSubmit` before skill expansion (2.1.299), `onFailure` (2.1.295, not valid on `Stop`), per-call `effort` on the Agent tool (2.1.292), worktree isolation fix (2.1.302), fork and foreground defaults conflicting between docs and changelog (2.1.302), `sonnet` alias is Sonnet 5.5; what was observed live is marked observed and the rest is marked unverified.
- [ ] `CLAUDE.md` is under 200 lines and 12KB, and the `ccf-budget` label equals the measured paid total (`context-budget.test.mjs` green).
- [ ] PENDING A5 is closed with the measured suite result; every task of this iteration is `in-review` before `/ccf:updatespec`.

## Test first (write before implementing)
`.claude/tests/changelog.test.mjs` goes red as soon as `package.json` reads 0.25.0 without an entry; `context-budget.test.mjs` is red until the label is moved.

## Files to touch
- `package.json`
- `plugins/ccf/.claude-plugin/plugin.json`
- `.claude-plugin/marketplace.json`
- `CHANGELOG.md`
- `plugins/ccf/README.md`
- `README.md`
- `CLAUDE.md`
- `.claude/rules/architecture.md`
- `.claude/rules/components.md`
- `.claude/rules/hooks.md`
- `.claude/rules/tooling.md`
- `.claude/rules/prompt-standard.md`
- `.claude/plan/PLAN.md`
- `.claude/plan/PENDING.md`

## Steps (thin end-to-end slice)
1. Bump the versions and add the CHANGELOG entry (the changelog test goes red, then green)
2. Edit the rules and docs, then re-measure and move the budget label
3. Run every gate, mark the task `in-review` (NOT `done`)
