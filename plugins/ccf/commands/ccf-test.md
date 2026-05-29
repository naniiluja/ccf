---
description: Design a contract-level test matrix (EP + BVA + decision table) for a function/slice, write the tests failing-first, run them, and report actual results vs the coverage gate. Only under a project that opted into the test discipline.
argument-hint: "[function/slice to test]"
allowed-tools: Read, Glob, Grep, Bash, Task
model: opus
---

You are running CCF `/ccf-test`. You design rigorous, contract-level tests for the target function/slice and **prove them by running**, never by claiming. You write tests + run them; you do NOT change the implementation under test (a failing test drives a separate fix).

## Steps

### 0. Load the test contract
Read the target project's `.claude/rules/testing.md` (root + the nested one for the package you're testing in). Extract: the test framework, the run command (`{{TEST_CMD}}` in the spec, resolved to the project's real command), where tests live, the coverage target, and **whether the matrix test-design discipline was opted in** (the "Test design discipline" block / `Matrix required: yes`). Also read the relevant `CLAUDE.md` for conventions.

### 1. Discipline gate
If the project did **NOT** opt into the matrix discipline (no "Test design discipline" block, or `Matrix required` is not `yes`): **report that this command only runs under a project that opted into the test discipline, and STOP.** Do not invent a matrix. (Suggest the user opt in at `/ccf:ccf-plan` / `/ccf:ccf-init` if they want it.)

### 2. Design the contract-level matrix
For the target function/slice from `$ARGUMENTS`, design the matrix at the **PUBLIC signature** (input → output / error), NOT on internal helpers (test behavior, not implementation). Combine the three ISTQB techniques:
- **Equivalence Partitioning (EP):** split each input's domain into classes treated alike; pick one representative per class (cuts redundant cases).
- **Boundary Value Analysis (BVA):** for each partition, test the edges — `min`, `min−1`, `max`, `max+1` — where bugs cluster.
- **Decision Table:** when the output depends on several interacting conditions, enumerate the combinations, one row per rule → expected action.

Output the matrix as a table (one column per input condition + an `Expected (output / error)` column; one row per equivalence class or boundary). Example for a numeric param valid `1..100`: rows for `0` (invalid, below), `1` (min boundary), `100` (max boundary), `101` (invalid, above), plus a typical mid-range valid value.

### 3. Write the tests (failing first)
Write the tests per the matrix, in the project's framework + test location, following the project's conventions. **Write them to fail first** (red) — confirm they are red before any implementation exists/changes. Shape the suite as a pyramid: keep these contract tests as fast unit/integration tests; do not over-rely on slow e2e (avoid the ice-cream-cone). For a slice that crosses a boundary, add the integration scope named in `testing.md`.

### 4. Run the project's test command
Run the project's actual test command (the resolved `{{TEST_CMD}}`) via Bash. Capture the real output.

### 5. Report actual results + coverage vs gate
Report the **ACTUAL** run output: which rows passed/failed, the observed values, and coverage measured against the project's coverage target / gate. **Never claim "tested" without having run.** If a matrix row fails, state it plainly (it indicates a bug to fix via `/ccf:ccf-fix` or the next implementer task — do not silently change the implementation here). State whether the coverage gate is met.

## Closing
- If rows fail, recommend `/ccf:ccf-fix` (disciplined debugging → failing test → minimal fix) for each failure.
- Recommend `/ccf:ccf-check` to review the slice against the spec, then `/code-review`, then `/ccf:ccf-updatespec`.
