# Task 002 — Path-scoped `paths:` rules — docs/wording delta

- **Vertical slice:** rule conventions + spec-writer agent + ccf-init command
- **Depends on:** 001 (serial queue, not a logical dependency)
- **Spec refs:** docs `code.claude.com/docs/en/memory` §Path-specific rules; `components.md` (Rule/Template conventions)
- **Implemented by:** ccf-implementer + MCP WebFetch (re-verify glob syntax against docs if in doubt)
- **Gate (must be GREEN before the next slice):** `claude plugin validate plugins/ccf` green; the 3 places (components.md / spec-writer / ccf-init) are consistent and glob syntax matches docs

## Goal (one sentence)
Strengthen end-user guidance on `paths:` (already used by all 6 be/fe templates) by adding a grounded glob-reference table + lazy-load explanation and syncing the wording across spec-writer and ccf-init.

## Acceptance criteria (verifiable)
- [ ] `components.md` gains a short glob-reference table (`**/*.ts`, `src/**/*`, `*.md`, brace `{ts,tsx}`) + the rule: "a rule without `paths:` loads every session; with `paths:` it loads only when Claude touches a matching file."
- [ ] `ccf-spec-writer.md` line 15 expands the `paths:` example (adds a brace-glob) + principle "only scope rules that are TRULY local; leave global rules without `paths:`".
- [ ] `ccf-init.md` A3 (line 31) wording matches the docs (syntax + lazy-load intent).
- [ ] No contradiction across the 3 places; every glob written matches the grounded docs table (no invented pattern).
- [ ] `claude plugin validate plugins/ccf` green.

## Test first (write before implementing)
Docs-only → "test" = a concrete artifact check:
1. Expected diff is explicit: components.md has the new glob table; spec-writer:15 has a brace-glob example; ccf-init:31 wording aligned.
2. Run `claude plugin validate plugins/ccf` → green.
3. Compare each glob written against the grounded docs table.

## Files to touch
- `plugins/ccf/.claude/rules/components.md` — glob table + lazy-load sentence (grounded).
- `plugins/ccf/agents/ccf-spec-writer.md` (line 15) — expand `paths:` example + scoping principle.
- `plugins/ccf/commands/ccf-init.md` (A3, line 31) — sync wording with docs.
- *(optional)* one explanatory line in `templates/root/.claude/rules/*.md.tmpl` — ONLY if it does not bloat the template.

## Steps (thin end-to-end slice)
1. (If unsure of glob syntax) WebFetch `code.claude.com/docs/en/memory` §Path-specific rules to re-confirm.
2. Edit components.md → spec-writer → ccf-init for one consistent story.
3. `claude plugin validate plugins/ccf`; confirm consistency.
4. `/ccf:ccf-check` → `/code-review` → `/ccf:ccf-updatespec`.

## Notes / best-practice sources
Claude Code docs (memory): `paths:` frontmatter, glob patterns, brace expansion, "rules without paths load unconditionally". The 6 templates (`api-design`, `data-layer`, `backend-conventions` = `["be/**"]`; `state-management`, `component-design`, `frontend-conventions` = `["fe/**"]`) already carry `paths:` — this task is documentation only.
