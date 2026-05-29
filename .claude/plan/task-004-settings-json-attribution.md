# Task 004 — `settings.json` template + `attribution`

- **Vertical slice:** new template + ccf-init + ccf-updatespec + git-workflow rule
- **Depends on:** 003 (serial queue, not a logical dependency)
- **Spec refs:** docs `code.claude.com/docs/en/settings` (`attribution: {commit, pr}`; `includeCoAuthoredBy` DEPRECATED; also `permissions`, `model`, `outputStyle`); `git-workflow.md` (current commit narrative; "settings supersede narrative")
- **Implemented by:** ccf-implementer + MCP WebFetch (re-verify settings/attribution schema)
- **Gate (final, must be GREEN):** instantiated JSON is valid (`JSON.parse`), uses `attribution` (not `includeCoAuthoredBy`); `claude plugin validate plugins/ccf` green; both commands consistent; grounded in docs

## Goal (one sentence)
Have `/ccf-init` generate a harness-level `.claude/settings.json` (mainly `attribution`) so commit attribution is enforced once, and have `/ccf-updatespec` check it's set — replacing the per-commit narrative ask.

## Acceptance criteria (verifiable)
- [ ] `templates/root/.claude/settings.json.tmpl` exists; instantiating it yields VALID JSON with NO comments.
- [ ] Usage-hint mechanism resolved: a companion `settings.json.tmpl.md` (or an inline block in `ccf-init.md`) — NOT a comment inside the JSON.
- [ ] Uses `attribution` key (per docs), NOT the deprecated `includeCoAuthoredBy`.
- [ ] `ccf-init.md` A3 (EMPTY) + B3 (EXISTING) generate `settings.json`; `attribution` inferred from the repo's git convention (do NOT invent — if history is thin, ask the user, same pattern as git-workflow).
- [ ] `ccf-updatespec.md` Closing checks `attribution` is set; if not, nudges the user to set it (does NOT auto-commit).
- [ ] `git-workflow.md` + its template note that harness-level settings enforce attribution (narrative = backup), grounded in docs.
- [ ] `claude plugin validate plugins/ccf` green.

## Test first (write before implementing)
- Instantiate the template with sample values → `JSON.parse` succeeds; `attribution` shape matches docs.
- `claude plugin validate plugins/ccf` → green.
- Read-confirm ccf-init (both branches) + ccf-updatespec are consistent.

## Files to touch
- `plugins/ccf/templates/root/.claude/settings.json.tmpl` — NEW. KISS: minimal, mainly `attribution` with `{{ATTRIBUTION_COMMIT}}`.
- `plugins/ccf/templates/root/.claude/settings.json.tmpl.md` (or inline in ccf-init) — usage hint (resolves the JSON-can't-hold-HTML-comments tension).
- `plugins/ccf/commands/ccf-init.md` — A3 + B3 generate settings.json from template; fill `attribution` from inferred git convention. (`allowed-tools` already has `Write` — no change.)
- `plugins/ccf/commands/ccf-updatespec.md` — Closing: check `attribution` is set; nudge if missing.
- `plugins/ccf/.claude/rules/git-workflow.md` + `templates/root/.claude/rules/git-workflow.md.tmpl` — harness-level > narrative, grounded.

## Steps (thin end-to-end slice)
1. WebFetch `code.claude.com/docs/en/settings` to confirm the `attribution` schema.
2. Decide the hint mechanism (companion `.md` vs inline) — companion file kept under `templates/` so it reads as a template artifact, not a spec rule.
3. Write the template + hint; instantiate-and-`JSON.parse` to verify.
4. Wire ccf-init (both branches) + ccf-updatespec; update git-workflow.
5. `claude plugin validate plugins/ccf`; confirm consistency.
6. `/ccf:ccf-check` → `/code-review` → `/ccf:ccf-updatespec`.

## Notes / best-practice sources
shanraisshan repo — "Attribution Control" + "Permissions Enforcement" (harness-level settings supersede narrative). Claude Code docs (settings): `attribution` replaces deprecated `includeCoAuthoredBy`. Match git-workflow's existing "infer from history, don't invent; ask if thin" pattern.
