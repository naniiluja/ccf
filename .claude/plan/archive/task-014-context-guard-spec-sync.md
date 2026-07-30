# Task 014 — Spec + docs sync (closing)

- **Vertical slice:** spec (`hooks.md`) + `CLAUDE.md` + READMEs + tsconfig + validate
- **Depends on:** 013
- **Spec refs:** `git-workflow.md` ("syncing on plugin structure changes" — a hook change touches hooks.md, README, tsconfig); `components.md` / `architecture.md` (keep counts + names consistent, files are source of truth); memory [[sync-hook-docs-both-places]]
- **Implemented by:** ccf-implementer, then `/ccf:ccf-check` + `/code-review`
- **Gate (must be GREEN):** `tsc --noEmit` exit 0; `node --test` green; `claude plugin validate plugins/ccf` passes; Grep shows ZERO dangling `context-nudge` / `decideNudge` references anywhere

## Goal (one sentence)
Bring the spec, CLAUDE.md, READMEs and tsconfig in line with the context-nudge → context-guard swap, so the docs match the real files (counts stay 6 cmd / 6 agent / 5 hook / 1 skill).

## Acceptance criteria (verifiable)
- [ ] `.claude/rules/hooks.md`: the `PostToolUse → context-nudge.mjs` bullet replaced by a `UserPromptSubmit → context-guard.mjs` description — two modes (warn via `systemMessage`+`additionalContext`; hard-block via `--hard-block` arg + exit 2), `/compact`+`ccf:override` escape, why exit 2, the accepted mid-turn tradeoff.
- [ ] `CLAUDE.md`: hook enumeration renames context-nudge → context-guard with the event change; count stays 5 hooks.
- [ ] `README.md` (+ `README.vi.md` / `README.zh-CN.md` if they name the hook, + MEMORY index): names/counts consistent; document how to opt into hard-block (add `--hard-block` to the hooks.json command).
- [ ] `tsconfig.json`: no stale `context-nudge` include.
- [ ] Grep: zero `context-nudge` and zero `decideNudge` references remain.

## Test first (write before implementing)
- N/A (docs slice) — verification is the Grep-clean + `claude plugin validate` + `tsc`/`node --test` still green gate.

## Files to touch
- `.claude/rules/hooks.md`, `CLAUDE.md`, `README.md` (+ `README.vi.md` / `README.zh-CN.md`), `MEMORY` index if it names the hook, `tsconfig.json`.

## Steps (thin end-to-end slice)
1. Rewrite the hooks.md bullet; update CLAUDE.md hook list.
2. Sync READMEs (all language variants that name the hook) + MEMORY index; document the `--hard-block` opt-in.
3. Grep for `context-nudge` / `decideNudge` → fix every hit; `tsc`; `node --test`; `claude plugin validate`.
4. `/ccf:ccf-check` → `/code-review` → `/ccf:ccf-updatespec`.

## Notes / best-practice sources
A structural hook change fans out across hooks.md + README + tsconfig (git-workflow.md). The real files in `hooks/` are the source of truth; README/MEMORY drift is fixed here. [[sync-hook-docs-both-places]].
