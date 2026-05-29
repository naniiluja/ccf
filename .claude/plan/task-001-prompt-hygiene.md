# Task 001 — Prompt-hygiene fixes

- **Vertical slice:** command prompts (no code, no hook)
- **Depends on:** — (first task)
- **Spec refs:** `architecture.md` (command/agent boundary; read-only parallel is the allowed exception to the sequential law), `components.md` (imperative wording)
- **Implemented by:** ccf-implementer (no MCP needed — pure markdown read/edit)
- **Gate (must be GREEN before the next slice):** read-confirm both files reflect the change; no contradiction with `architecture.md`

## Goal (one sentence)
Tighten two command prompts: make `ccf-fix` hypothesis-branching a conditional MUST, and make `ccf-plan` forbid hiding a refactor inside a feature task.

## Acceptance criteria (verifiable)
- [ ] `ccf-fix.md`: hypothesis-branching changed from "you may" → "you MUST, if the bug has ≥2 independent hypothesis branches", explicitly noting this is the read-only exception to the sequential law (parallel research is allowed).
- [ ] `ccf-plan.md` step 4 (SEQUENTIAL law): adds a sentence — "Refactor and feature are sequentially separate tasks, each with its own gate; NEVER hide a refactor inside a feature task."
- [ ] Wording is imperative/decisive; consistent with the spec.
- [ ] No change to `allowed-tools` / `model` of either command.

## Test first (write before implementing)
Prompt change → "test" = a concrete read-confirm scenario:
1. After edit, re-read `ccf-fix.md` around the branching line: it is now a conditional MUST and names "read-only exception".
2. Re-read `ccf-plan.md` step 4: the refactor≠feature sentence is present.
3. Cross-check `architecture.md`: the read-only-parallel exception is already permitted there → no contradiction.

## Files to touch
- `plugins/ccf/commands/ccf-fix.md` (~line 18 + 27/30) — branching "may" → conditional MUST + read-only-exception note.
- `plugins/ccf/commands/ccf-plan.md` (step 4, SEQUENTIAL law) — add refactor≠feature sentence.

## Steps (thin end-to-end slice)
1. Read both files; locate the exact lines.
2. Edit minimally — preserve surrounding numbered structure and tone.
3. Re-read to confirm the three test scenarios above.
4. `/ccf:ccf-check` → `/code-review` → `/ccf:ccf-updatespec`.

## Notes / best-practice sources
shanraisshan/claude-code-best-practice — "Bug Fixing Discipline" (distributed hypothesis agents) + "Vertical slices over horizontal phasing" (separate refactor from feature). CCF architecture.md already allows read-only parallel research as the sole sequential-law exception.
