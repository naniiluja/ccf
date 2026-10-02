# Task 084 — spec-budget script + rule/narrative split

- **Vertical slice:** pure lib + read-only script + `/ccf:updatespec` step 3 and Closing + `ccf-spec-writer` output shape
- **Depends on:** —
- **Spec refs:** `CLAUDE.md` core invariants (200 lines AND 12KB; the whole `@import` set is paid every session); `.claude/rules/testing.md` (context-budget check); `.claude/tests/context-budget.mjs` (`measurePaidBytes`); grounding `code.claude.com/docs/en/memory` (`@import`: relative to the importing file, absolute and `@~/` allowed, at most four hops, ignored in code spans and fenced blocks, not imported when double-quoted, spaces escaped as `\ `).
- **MCP to use:** none
- **discipline:** on
- **Gate (must be GREEN before the next slice):** `node --test plugins/ccf/hooks/lib/*.test.mjs`, `node --test .claude/tests/*.test.mjs`, `node --test "plugins/ccf/templates/*/.claude/hooks/lib/*.test.mjs"`, `node /home/hatch/coder/ccf/node_modules/typescript/bin/tsc --noEmit`, `claude plugin validate plugins/ccf`, `node plugins/ccf/scripts/spec-budget.mjs --dir .`.

## Goal (one sentence)
`/ccf:updatespec` measures the real per-session spec cost (`CLAUDE.md` plus every recursive `@import`) before and after every run, and its drafting step separates verifiable rules from narrative that belongs in `ARCHIVE.md` or memory.

## Acceptance criteria (verifiable)
- [ ] `plugins/ccf/hooks/lib/spec-budget.mjs` (pure): `parseImports(text)` follows the grounded rules above; `resolveImportTree(root, readFile)` stops at four hops, survives cycles, skips missing files with a warning, resolves relative to the importing file.
- [ ] `plugins/ccf/scripts/spec-budget.mjs`: `--dir`; JSON with per-file bytes + lines + depth, `total`, `claudeMdOver` (200 lines / 12KB), `missing`; read-only; exit 0.
- [ ] On this repo, `total` equals `.claude/tests/context-budget.mjs`'s `measurePaidBytes` result, and `prompt-standard.md` (not imported) is not counted.
- [ ] `updatespec.md` step 3 states the rule-vs-narrative criterion (a rule is one verifiable sentence; narrative moves to `ARCHIVE.md` or memory) and where it moves; Closing runs `spec-budget.mjs` at the start and the end and prints "before → after".
- [ ] `ccf-spec-writer.md` returns two parts: rules, and narrative to relocate; its "max depth 5" becomes "at most four hops".

## Test first (write before implementing; confirm RED)
- `parseImports` matrix: `@a.md`, `@~/x.md`, `@Design\ Docs/a.md`, `"@a.md"` (skip), inside backticks (skip), inside a fenced block (skip), email `a@b.com` (skip).
- `resolveImportTree`: 0/4/5 hops (the fifth hop is not counted), cycle A→B→A, missing file, relative to the importing file.

## Files to touch
- `plugins/ccf/hooks/lib/spec-budget.mjs` (new)
- `plugins/ccf/hooks/lib/spec-budget.test.mjs` (new)
- `plugins/ccf/scripts/spec-budget.mjs` (new)
- `plugins/ccf/commands/updatespec.md`
- `plugins/ccf/agents/ccf-spec-writer.md`
- `tsconfig.json`

## Steps
1. Write the failing tests. 2. Implement minimally. 3. Run the gate; GREEN → `in-review`. 4. `/ccf:check` → `/ccf:updatespec`.
