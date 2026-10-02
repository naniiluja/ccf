# Task 083 — Runtime evidence field in the gate

- **Vertical slice:** pure lib + `worktree-preflight` problem + task template + `plan` skill step 5 + `/ccf:cook` brief + `/ccf:check` + `/ccf:updatespec` + repo latches
- **Depends on:** 082
- **Spec refs:** `.claude/rules/architecture.md` (cook writers only in worktrees; preflight gates merge); `.claude/rules/tooling.md` (`worktree-preflight.mjs` problems); `.claude/rules/prompt-standard.md` (review markers); task 082 (`accepted` + `risk` row).
- **MCP to use:** none
- **discipline:** on
- **Gate (must be GREEN before the next slice):** `node --test plugins/ccf/hooks/lib/*.test.mjs`, `node --test .claude/tests/*.test.mjs`, `node --test "plugins/ccf/templates/*/.claude/hooks/lib/*.test.mjs"`, `node /home/hatch/coder/ccf/node_modules/typescript/bin/tsc --noEmit`, `claude plugin validate plugins/ccf`.

## Goal (one sentence)
A slice that touches a UI cannot pass the gate unless someone recorded running it for real, or recorded why not, and a "not run" can at best close as `accepted`.

## Acceptance criteria (verifiable)
- [ ] Task template gains `**Touches UI:** yes|no` and `**Runtime evidence:**` (`<command/step> -> <observed result>` or verbatim `not run: <reason>`).
- [ ] `plugins/ccf/hooks/lib/runtime-evidence.mjs` (pure): `readRuntimeEvidence(taskText)` → `{ touchesUi, evidence, state: "ran" | "not-run" | "empty" | "not-required" }`.
- [ ] `worktree-preflight` reports `missing-runtime-evidence` (blocks merge, `ready: false`) when `Touches UI: yes` and the field is empty; the branch's OWN task file is allowed in scope so the agent can fill the field; another task's file stays `out-of-scope`.
- [ ] `skills/plan/SKILL.md` step 5 sets `Touches UI`; stays within its byte limit latched by `skill-plan.test.mjs`.
- [ ] `cook.md` brief: the agent fills `Runtime evidence` in its own task file after running the gate (an explicit exception to "leave other task files alone").
- [ ] `check.md`: empty field on a UI task = `FAIL:`, `not run` = `WARN:`.
- [ ] `updatespec.md`: a `not run` UI task may only be written `accepted` (with a `risk` row in `PENDING.md`), never `done`.
- [ ] `parallel-cook.test.mjs` + `skill-plan.test.mjs` latch the new sentences, seen RED first.

## Test first (write before implementing; confirm RED)
- `readRuntimeEvidence` matrix: missing `Touches UI` line (treated as `no`), `yes` + empty, `yes` + `not run:` with no reason (= empty), `yes` + `not run: no browser`, `yes` + evidence, `no` + empty, upper/lower case, emphasis `**yes**`.
- Preflight: own task file in scope; another task's file `out-of-scope`; UI=yes + empty → `missing-runtime-evidence`.

## Files to touch
- `plugins/ccf/hooks/lib/runtime-evidence.mjs` (new)
- `plugins/ccf/hooks/lib/runtime-evidence.test.mjs` (new)
- `plugins/ccf/hooks/lib/worktree-preflight.mjs`
- `plugins/ccf/hooks/lib/worktree-preflight.test.mjs`
- `plugins/ccf/hooks/lib/worktree-preflight-script.test.mjs`
- `plugins/ccf/scripts/worktree-preflight.mjs`
- `plugins/ccf/templates/root/.claude/plan/task-template.md.tmpl`
- `plugins/ccf/skills/plan/SKILL.md`
- `plugins/ccf/commands/cook.md`
- `plugins/ccf/commands/check.md`
- `plugins/ccf/commands/updatespec.md`
- `.claude/tests/parallel-cook.test.mjs`
- `.claude/tests/skill-plan.test.mjs`

## Known risk
Worktree agents may not edit task files (cook.md step 5); exactly one exception must open, or the preflight blocks every UI task.

## Steps
1. Write the failing tests. 2. Implement minimally. 3. Run the gate; GREEN → `in-review`. 4. `/ccf:check` → `/ccf:updatespec`.
