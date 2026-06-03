# Task 019 — Spec + docs + counts sync (5 → 6 hooks; document the mechanism)

- **Vertical slice:** spec + docs sync — teach the grounded mechanism (output style ≠ subagent; rules in `.claude/rules` propagate; CCF injects via SubagentStart) and bring every count/enumeration to 6 hooks.
- **Depends on:** 018 (sync the docs only after the hook + agent wording are final).
- **Spec refs:** `git-workflow.md` ("syncing on plugin structure changes"; README divergence = drift); `hooks.md`; `architecture.md`; `components.md`.
- **Implemented by:** ccf-implementer. **Test discipline:** off (docs slice — verify by grep + validate + re-read).
- **Gate (closes the iteration):** grep-consistency (`6` hooks everywhere counts appear across the 3 READMEs + `plugins/ccf/README.md` + `CLAUDE.md`; `agent-rules-inject` named consistently; NO "5 .mjs"/"5 hook" left; `io.mjs` JSDoc + `hooks.md` I/O-contract both list `SubagentStart` for additionalContext) + `claude plugin validate` + `npx -p typescript tsc --noEmit` exit 0 + `node --test` all green + cross-file re-read.

## Goal (one sentence)
The spec, template and all READMEs document the output-style-vs-subagent mechanism and consistently report 6 hooks, so the docs match the real files after Tasks 017–018.

## Acceptance criteria (verifiable)
- [ ] `.claude/rules/hooks.md`: (a) `agent-rules-inject.mjs` described under "Events CCF currently uses" (event `SubagentStart`, no matcher, allowlist writer-agent, `additionalContext` channel, best-effort); (b) I/O-contract lists `SubagentStart` as additionalContext-valid; (c) the PreToolUse "permissionDecision/permissionDecisionReason only" claim corrected (grounded: PreToolUse also accepts `updatedInput`/`additionalContext`, but CCF doesn't use them).
- [ ] `.claude/rules/architecture.md`: new "Agent context & rule propagation" subsection (output style ≠ subagent; `.claude/rules` auto-loads into subagents; CCF restates via the SubagentStart hook) citing [#8395](https://github.com/anthropics/claude-code/issues/8395).
- [ ] `CLAUDE.md` line ~17: `5 → 6` hooks + add `agent-rules-inject` (note SubagentStart); "Current plan" updated.
- [ ] `README.md` + `README.vi.md` + `README.zh-CN.md`: count (~line 120) `5 → 6` + a NEW hook-table row (~line 78) for `agent-rules-inject | SubagentStart | …` in ALL three; the shared-lib list (~line 120) gains `output-style` (opportunistic: also add the already-missing `git-trace`/`verify-trace`).
- [ ] `plugins/ccf/README.md`: tree (lines 30-34) gains `agent-rules-inject.mjs` + `lib/output-style.mjs` (opportunistic: also `lib/git-trace.mjs` + `lib/verify-trace.mjs`, currently missing).
- [ ] `plugins/ccf/templates/root/.claude/rules/coding-conventions.md.tmpl`: +1 line — enforceable coding rules live in `.claude/rules` (subagents auto-load); do NOT keep rules only in an output style (it doesn't reach subagents).
- [ ] Counts elsewhere stay 6 cmd / 6 agent / **6 hook** / 1 skill.

## Test first (write before implementing)
N/A (docs slice). The "failing test" is the cross-doc grep stated first: before, the docs say "5 hooks" and never mention `agent-rules-inject`/SubagentStart; after, the language-neutral grep (`6`, `agent-rules-inject`, `SubagentStart`) is consistent and no "5 hook"/"5 .mjs" remains. Verify both states.

## Files to touch
- `.claude/rules/hooks.md`, `.claude/rules/architecture.md`
- `CLAUDE.md`
- `README.md`, `README.vi.md`, `README.zh-CN.md`
- `plugins/ccf/README.md`
- `plugins/ccf/templates/root/.claude/rules/coding-conventions.md.tmpl`

## Steps (thin end-to-end slice)
1. Confirm before-state grep (5 hooks; no agent-rules-inject/SubagentStart).
2. Update the two rules (hooks.md, architecture.md) + CLAUDE.md.
3. Update the 3 READMEs (count + table row + lib list) + `plugins/ccf/README.md` tree + the template line.
4. Run grep-consistency + `claude plugin validate` + `tsc --noEmit` + `node --test`; cross-read.
5. Mark `in-review`; `/ccf:ccf-check` → `/code-review` → `/ccf:ccf-updatespec` sets `done` (+ saves the memory fact).

## Notes / best-practice sources
A spec change that leaves any README/CLAUDE.md count stale IS drift (`git-workflow.md`). Real files in `hooks/` are the source of truth; this task makes the docs honest. Opportunistic tree/lib-list fixes follow "fix drift on next touch".
