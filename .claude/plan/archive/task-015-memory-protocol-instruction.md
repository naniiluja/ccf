# Task 015 — Align `ccf-updatespec` memory instructions with the real mechanism

- **Vertical slice:** lõi instruction `plugins/ccf/commands/ccf-updatespec.md` (the source-of-truth prompt Claude runs) — behavior change.
- **Depends on:** — (first task of this iteration)
- **Spec refs:** `components.md` (a command body is a second-person prompt; concise, each sentence adds info); `coding-conventions.md` (no duplication, each sentence new info); `tooling.md` (ground decisions in official docs and CITE). Memory: [[sync-hook-docs-both-places]] (the spec-vs-memory two-tier idea this command implements).
- **Implemented by:** ccf-implementer, then `/ccf:ccf-check` + `/code-review`.
- **Gate (must be GREEN) — grep is PRIMARY:** Grep on the edited file shows `[[file-name]]` GONE, `200 lines`+`25KB`+`autoMemoryEnabled` PRESENT, the existing `< ~200 chars` per-line cap STILL present, `feedback` flagged as the strongest type; `claude plugin validate plugins/ccf` exit 0; re-read confirms a coherent < 60-line prompt with no sentence duplicating lines 20/40.

## Precondition (hard gate — carry the grounding forward)
Re-state these 3 already-grounded facts at the top of this task's work log WITH citations (a quick Context7 re-confirm of the 200/25KB wording is allowed, but the citation MUST be recorded — do not ship an unverified number into the prompt):
- **"first 200 lines OR 25KB (whichever comes first)" + curate-if-exceeds** — Context7 `/websites/code_claude`, confirmed by `code.claude.com/docs/en/memory`, `/context-window`, `/sub-agents`, `/claude-directory`.
- **`autoMemoryEnabled` (on by default, requires v2.1.59+), also `/memory` toggle + `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`** — Context7 `code.claude.com/docs/en/memory`.
- **Cross-link `[[name]]` = the `name:` frontmatter slug** — the live system-prompt memory protocol ("Link related memories with `[[their-name]]`, where `name` is the other memory's `name:` slug").

## Goal (one sentence)
Make `/ccf:ccf-updatespec`'s memory-writing instructions match Claude Code's real Memory mechanism on 5 points (MEMORY.md index cap, `[[name]]` links, point-in-time/verify, Auto Memory interplay, feedback-is-strongest) without adding any artifact.

## Acceptance criteria (verifiable)
- [ ] **Step 5 MEMORY.md line (line 42):** adds "MEMORY.md is a PURE INDEX loaded every session; only its first **200 lines or 25KB (whichever comes first)** are read — keep it lean and **curate/prune** as it nears the limit." The existing per-line `< ~200 chars` cap is PRESERVED (distinct axis). Cross-link form fixed to `[[name]]` (the `name:` slug); the index-entry form `- [Title](file.md) — hook` is left unchanged.
- [ ] **Step 5 staleness bullet (line 43):** "line-independent descriptions" expanded into the point-in-time principle — describe intent/behavior not a code location (e.g. "auth via middleware, entry in main.go", NOT "the check at line 42"); a recalled memory reflects what was true when written, so a reader must verify the file/function/flag still exists before asserting it.
- [ ] **Feedback elevated IN PLACE (edit lines 20 + 40, do NOT append a new block):** `feedback` named the STRONGEST, most-followed memory type; "record both wins AND losses (a losses-only memory makes future sessions timid/over-cautious)" explicit; the `Why:` stated as mandatory (rigid obedience + edge-case stalls without it; intent-grasp + ambiguity-handling with it).
- [ ] **Auto-Memory note (1 line, in step 5 or the "Why two places" block):** `autoMemoryEnabled` (default on, v2.1.59+) may already have auto-saved notes; `/ccf-updatespec` is the deliberate curation pass — review/dedupe, then write high-signal lessons explicitly.
- [ ] No new command/agent/hook/rule; counts stay 6 cmd / 6 agent / 5 hook / 1 skill; frontmatter still valid.

## Test first (write before implementing)
- N/A in the unit-test sense (prompt/markdown slice). The "failing test" is the grep gate above stated FIRST: before editing, the greps for `200 lines`/`25KB`/`autoMemoryEnabled`/feedback-strongest FAIL and `[[file-name]]` is PRESENT; after editing they must invert. Verify both states.

## Files to touch
- `plugins/ccf/commands/ccf-updatespec.md` ONLY.

## Steps (thin end-to-end slice)
1. Record the 3 grounded citations in the work log (precondition).
2. Edit line 42 (index cap + curate + `[[name]]`, keep `< ~200 chars`), line 43 (point-in-time/verify), lines 20+40 in place (feedback-strongest), add the 1-line Auto-Memory note.
3. Run the grep gate (assert the inversion) + `claude plugin validate plugins/ccf` + re-read for coherence/no-duplication.
4. `/ccf:ccf-check` → `/code-review` → `/ccf:ccf-updatespec`.

## Notes / best-practice sources
Ground-before-write is a CCF law; all 5 facts were verified this planning session (Context7 4 pages + live protocol) — the implementer carries citations forward, does not re-discover blindly. Deliberately NOT adding the blog's unverified "stale after 2 days" / "module #11/22" internals — keep the principle (point-in-time, verify) without the unconfirmed numbers.
