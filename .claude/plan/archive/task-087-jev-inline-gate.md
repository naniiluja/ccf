# Task 087 — Jev inline gate: small cook tasks run in the main session

- **Vertical slice:** lib `inline-gate.mjs` + `scripts/plan-waves.mjs --inline` + `commands/cook.md` step 2/4a0 + spec/docs sync
- **Depends on:** —
- **Spec refs:** `.claude/rules/architecture.md` (Command ↔ agent boundary); `.claude/rules/tooling.md` (`plan-waves.mjs`, `memory-audit.mjs` Jev pattern); `.claude/rules/coding-conventions.md` (no comments in new code).
- **MCP to use:** none
- **Gate (must be GREEN before the next slice):** `node --test plugins/ccf/hooks/lib/*.test.mjs`, `node --test .claude/tests/*.test.mjs`, templates lib suite, `node node_modules/typescript/bin/tsc --noEmit`, `claude plugin validate plugins/ccf`.
- **Touches UI:** no
- **Runtime evidence:**

## Goal (one sentence)
`/ccf:cook` runs a task Jev judges small directly in the main session, and keeps every other task (and every task when Jev is unavailable) in its isolated worktree.

## Acceptance criteria (verifiable)
- [ ] `plan-waves.mjs --inline` with `TYPESAFE_API_KEY` asks Jev one Noul per code-eligible task (not `Touches UI: yes`, 1 to 3 concrete paths) with title, goal, files + current line counts and criteria as state, and marks a task `mode: "inline"` only at a score of 0.7 or more.
- [ ] Without `--inline`, without the key, on any Jev failure (HTTP error, network, timeout, bad JSON), a state over 80KB, or a missing answer, every task stays `mode: "worktree"`; `modeReason` and the top-level `inline` status say why; exit 0 and the key is never printed.
- [ ] `cook.md` passes `--inline` only with the key, states what leaves the machine, implements `inline` tasks in step 4a0 before spawning the wave's worktree agents, and spawns agents only for `worktree` tasks.
- [ ] Existing wave/edge output of `plan-waves.mjs` is unchanged.

## Test first (write before implementing)
- `plugins/ccf/hooks/lib/inline-gate.test.mjs`: eligibility, request shape, cap, small → inline, large → worktree, every failure status → worktree, unanswered → worktree.
- `plugins/ccf/hooks/lib/inline-gate-script.test.mjs`: `plan-waves.mjs --inline` against a `node:http` fake Jev (ok, 429, unreachable, no key, no flag).

## Files to touch
- `plugins/ccf/hooks/lib/inline-gate.mjs` (new)
- `plugins/ccf/hooks/lib/inline-gate.test.mjs` (new)
- `plugins/ccf/hooks/lib/inline-gate-script.test.mjs` (new)
- `plugins/ccf/scripts/plan-waves.mjs`
- `plugins/ccf/commands/cook.md`
- `plugins/ccf/README.md`
- `.claude/rules/architecture.md`
- `.claude/rules/tooling.md`
- `.claude/rules/prompt-standard.md` (ccf-budget label)
- `CLAUDE.md`
- `.claude/plan/PLAN.md`

## Steps (thin end-to-end slice)
1. Write the failing tests
2. Implement the pure gate, wire it into `plan-waves.mjs`, then the `cook.md` steps
3. Run the gate, mark the task `in-review` (NOT `done`)
4. `/ccf:check` → `/ccf:updatespec`

## Notes
- Threshold 0.7 is stricter than the 0.5 criteria threshold because a wrong "small" loses isolation while a wrong "large" only costs a worktree; it is NOT backtested on real tasks yet.
- A `Touches UI: yes` task never runs inline, because only `worktree-preflight.mjs` enforces `missing-runtime-evidence` and the inline path has no preflight.
- Same advisory pattern as `memory-audit.mjs --jev`: opt-in by flag and key, 30s timeout (`CCF_JEV_TIMEOUT_MS`), silent fallback; the orchestrator may still send an `inline` task to a worktree, never the reverse.
