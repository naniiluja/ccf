# Task 055 — completion-evidence Stop hook + spec sync

- **Vertical slice:** thin I/O hook + hooks.json entry + process-level tests against a local fake server + count/spec sync.
- **Depends on:** 054
- **Spec refs:** `.claude/rules/hooks.md` (auto-verify pattern, opt-in by argv, fail-open), `architecture.md`, `prompt-standard.md` (ccf-budget label)
- **MCP to use:** none
- **Gate:** the three test suites, `tsc`, `claude plugin validate plugins/ccf`, pipe smoke, count grep, re-measured `ccf-budget`

## Goal (one sentence)
When enabled by `--completion-evidence` and `TYPESAFE_API_KEY` is set, a Stop with an in-review task and code edits this session asks Jev whether the diff and test output meet the task's acceptance criteria and prints the unmet ones as an advisory, never blocking.

## Acceptance criteria (verifiable)
- [ ] No flag, no key, no in-review task, `stop_hook_active`, no code edited this session, or an already-asked (task id + diff hash) marker: silent `exit 0` and no network call
- [ ] Evidence: criteria from the task file, `git diff HEAD` (spawnSync, `shell:false`) plus untracked files' content, sensitive paths dropped and named, over-cap diff skipped with one line; test output from the last test-command tool_result (role-gated)
- [ ] Output via `emitSystemMessage` only; names each unmet criterion; the key never appears in stdout, stderr or argv
- [ ] `fetch` aborts at about 6.5s; every failure path (401, 429, 529, bad JSON, hang, network) exits 0 silently
- [ ] Base URL overridable by `CCF_JEV_URL` for tests; default `https://api.typesafe.ai`
- [ ] Process-level cases in `io.test.mjs` against a `node:http` server on 127.0.0.1: one unmet criterion, 401, 429, 529, malformed JSON, hang past the deadline, missing key, missing flag
- [ ] `hooks.json`: third object in `Stop`, NO flag; description updated
- [ ] Counts 6 to 7 hooks in CLAUDE.md, architecture.md, hooks.md, three READMEs, plugins/ccf/README.md; grep also for `= 6 `.mjs`` style forms; README + tooling.md document `TYPESAFE_API_KEY`, the flag, and that the diff leaves the machine
- [ ] CLAUDE.md stays under 200 lines and 12KB (trim the 049/050 history in `## Current plan`); `ccf-budget` refilled as the LAST edit

## Test first
The process-level cases above, then the hook. Confirm RED first.

## Files to touch
plugins/ccf/hooks/completion-evidence.mjs (new), hooks.json, hooks/lib/io.test.mjs, CLAUDE.md, .claude/rules/{architecture,hooks,tooling,prompt-standard}.md, README.md/.vi/.zh-CN, plugins/ccf/README.md
