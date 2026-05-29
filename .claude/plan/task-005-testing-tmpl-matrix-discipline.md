# Task 005 — Expand `testing.md.tmpl` (contract-level matrix discipline)

- **Vertical slice:** template (1 file: the generated target-project testing rule)
- **Depends on:** 004 (serial queue, not a logical dependency)
- **Spec refs:** `components.md` (template `{{UPPER_SNAKE}}` placeholders + HTML-comment usage hints, must obey the rule it molds); `coding-conventions.md` (KISS/YAGNI); ISTQB glossary (EP/BVA/Decision Table); `martinfowler.com/bliki/TestPyramid.html`; `kentcdodds.com/blog/write-tests`
- **Implemented by:** ccf-implementer + MCP none (grounding cites already collected in the approved plan)
- **Gate (must be GREEN before the next slice):** read-confirm template; every new placeholder is `{{UPPER_SNAKE}}`; opt-in OFF leaves NO leaked empty placeholder/section (guided by HTML comment for `/ccf-init` to drop the block); the brittle/contract-level tension is stated explicitly; KISS (no bloat)

## Goal (one sentence)
Extend the target-project `testing.md.tmpl` with an OPT-IN "test design discipline" section (EP + BVA + Decision Table + Test Pyramid, applied at the contract level) plus the placeholders `/ccf-init` will fill, so a project that opts in gets the Toyota-style rigor while a ship-fast project gets the existing sparse rule unchanged.

## Acceptance criteria (verifiable)
- [ ] New section `## Test design discipline (when adopted)` added, wrapped so `/ccf-init` keeps it only when opted in (HTML comment instruction, NOT a leaked empty placeholder).
- [ ] Section defines EP, BVA, Decision Table briefly + when to use each (cite ISTQB); states the **contract-level** rule (apply the matrix to a function's public signature input→output/error, NOT internal helpers).
- [ ] Section states the Test Pyramid (unit→integration→e2e) + the "ice cream cone" warning, and the explicit tension: full combinatorial matrix on every internal function = brittle; CCF applies the matrix at contract level + risk-based internally.
- [ ] A suggested matrix layout is included (columns = input conditions + expected action/error; rows = each equivalence class / boundary).
- [ ] New placeholders present and `{{UPPER_SNAKE}}`: `{{TEST_MATRIX_REQUIRED}}` (yes/no), `{{INTEGRATION_TEST_SCOPE}}`, `{{E2E_TEST_SCOPE}}`, `{{TEST_GATE_ENFORCEMENT}}` (prompt-only / stop-hook).
- [ ] The existing sparse rule (framework/cmd/location/coverage) is preserved; opt-in OFF output is essentially today's template (no regression).

## Test first (write before implementing)
- Template is markdown (not executable) → "test" = a read-confirm scenario, written as the acceptance criteria above:
  1. Mentally instantiate with `TEST_MATRIX_REQUIRED=no` → the discipline section is dropped (no leaked `{{...}}`, no empty heading).
  2. Instantiate with `TEST_MATRIX_REQUIRED=yes` → the discipline section renders with EP/BVA/Decision Table + contract-level rule + pyramid + tension paragraph.
  3. Grep the file for `{{` → every placeholder is `UPPER_SNAKE`.

## Files to touch
- `plugins/ccf/templates/root/.claude/rules/testing.md.tmpl` — add the opt-in discipline section + 4 new placeholders; keep < KISS, obey the "template molds another project's spec" rule.

## Steps (thin end-to-end slice)
1. Write the read-confirm scenarios (above) as the verification target.
2. Add the discipline section + placeholders; mark the opt-in block with an HTML comment telling `/ccf-init` when to keep/drop it.
3. Instantiate-on-paper both ways (opt-in ON/OFF) → confirm no leaked placeholder, tension stated, KISS respected.
4. `/ccf:ccf-check` → `/code-review` → `/ccf:ccf-updatespec`.

## Notes / best-practice sources
ISTQB glossary (Equivalence Partitioning, Boundary Value Analysis, Decision Table Testing) — `istqb-glossary.page`. Test Pyramid — `martinfowler.com/bliki/TestPyramid.html`. Test behavior not implementation — `kentcdodds.com/blog/write-tests`. Tension: contract-level matrix avoids brittle implementation-coupled tests.
