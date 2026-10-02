# Task 078 — `ccf-finding-refuter` agent + `check.md` step 6c

- **Vertical slice:** new read-only refuter agent + the `/ccf:check` step that spawns it only when a `FAIL:` exists
- **Depends on:** 077
- **Spec refs:** code.claude.com/docs/en/best-practices (adversarial review; "a reviewer prompted to find gaps will usually report some, even when the work is sound"); code.claude.com/docs/en/workflows ("fan out, then collect and verify the findings"); `.claude/rules/components.md` (agent frontmatter, maxTurns, PARTIAL); `.claude/rules/prompt-standard.md` (points 6 and 7, style block, markers); `check.md` step 6b precedent ("never delete or downgrade a `FAIL:`").
- **MCP to use:** none
- **discipline:** off
- **Gate:** `node --test .claude/tests/*.test.mjs`, `node --test plugins/ccf/hooks/lib/*.test.mjs`, `claude plugin validate plugins/ccf`.

## Goal (one sentence)
After `/ccf:check` merges its reviews, a fresh agent tries to refute each `FAIL:` with quoted evidence, and a refuted finding stays `FAIL:` with `Refuted (ccf-finding-refuter): <evidence>` appended.

## Agent
- Frontmatter: `model: sonnet`, `effort: medium`, `maxTurns: 25`, `disallowedTools: Write, Edit, NotebookEdit, Agent, Task`; `description` follows task 077's trigger form and says "Read-only".
- Body opens with the role and closes with the return format; carries the style block.
- Input: the `FAIL:` lines, the task file, the diff base.
- Per `FAIL:` it returns `REFUTED <file:line>` with evidence (code quoted verbatim at that location, or a command run and its real output), or `STANDS <file:line>` with why refutation failed. No evidence means STANDS. It adds no new findings.

## check.md step 6c
- Runs only when the merged report has at least one `FAIL:`. Spawns one refuter with `run_in_background: false` and waits for the completion notification.
- Appends `Refuted (ccf-finding-refuter): …` to the matching `FAIL:` line. Never deletes or downgrades a marker; the `FAIL:` line count before and after this step is equal.
- A PARTIAL result is handled like step 3: continue once with `SendMessage`.
- One sentence says the user decides what to do with a refuted `FAIL:`.
- `allowed-tools` already has `Task, SendMessage`.
- No marker contract changes: `cook.md`, `updatespec.md`, `verify-chain.mjs`, and the `/^\s*[-*]\s*FAIL:/` regex in `finding-verify.mjs` stay as they are.

## Acceptance criteria (verifiable)
- [ ] The agent's frontmatter matches every field above.
- [ ] `check.md` names `ccf-finding-refuter`, the "only when … `FAIL:`" condition, and `run_in_background: false` inside step 6c.
- [ ] `check.md` has the never-delete-or-downgrade sentence and the equal-`FAIL:`-count sentence.
- [ ] `run_in_background: false` lines across `commands/*.md` + `skills/plan/SKILL.md` total 9.
- [ ] Lib suite stays green; no file under `hooks/lib` changes; `review-trace.mjs` still keys only on `ccf-spec-checker`.

## Test first (write before implementing; confirm RED)
- `.claude/tests/check-refuter.test.mjs`.

## Files to touch
- `plugins/ccf/agents/ccf-finding-refuter.md` (new)
- `plugins/ccf/commands/check.md`
- `.claude/tests/check-refuter.test.mjs` (new)
