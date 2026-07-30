# Task 018 — Harden `ccf-implementer` body to obey rules + active output style

- **Vertical slice:** agent prompt (embed-in-agent layer) — the subagent's own system prompt restates the must-obey rules as a backup to the Task-017 hook (defense-in-depth, like `plan-mode-guard ↔ ccf-plan step 0`).
- **Depends on:** 017 (the hook is the primary delivery; this body wording is its prompt backup).
- **Spec refs:** `architecture.md` ("Deterministic part vs prompt part" — hook primary, prompt backup); `components.md` (agent body conventions); best practice "embed output rules in the subagent's own definition" + "restate must-have rules" (`code.claude.com/docs/en/sub-agents`).
- **Implemented by:** ccf-implementer. **Test discipline:** off (prompt slice — verify by grep + re-read).
- **Gate (must be GREEN before 019):** grep finds the new wording (active-output-style read + self-check) in `ccf-implementer.md`; `claude plugin validate plugins/ccf` exit 0 (frontmatter still valid); re-read confirms it is consistent and does not contradict the hook.

## Goal (one sentence)
`ccf-implementer.md` explicitly tells the agent to read & obey `.claude/rules/*` AND the active output style's coding rules (persona excluded), and to self-check its diff before reaching `in-review` — so rule-compliance holds even where the hook can't reach.

## Acceptance criteria (verifiable)
- [ ] Step 2 expanded: read `.claude/rules/*` + CLAUDE.md AND, if set, the active output style (`outputStyle` in settings → `.claude/output-styles/<name>.md`) — extract its CODING/style rules only, IGNORE persona/tone.
- [ ] Constraints gain: "**Self-check** the diff against those rules before setting status `in-review`."
- [ ] One line notes the `agent-rules-inject` (SubagentStart) hook also injects these at start, and this body is the prompt backup layer.
- [ ] Frontmatter (`name`/`description`/`model`/`tools`) unchanged; file still valid.

## Test first (write before implementing)
N/A (prompt slice). The "failing test" is the grep stated first: before, `ccf-implementer.md` has NO mention of the active output style or a self-check step; after, grep finds both. Verify both states.

## Files to touch
- `plugins/ccf/agents/ccf-implementer.md` — step 2 + Constraints + one backup-layer line.

## Steps (thin end-to-end slice)
1. Confirm the before-state grep (no output-style / self-check wording).
2. Edit step 2 + Constraints + add the hook-backup line.
3. Grep the after-state + `claude plugin validate` + re-read for consistency with Task 017.
4. Mark `in-review`; `/ccf:ccf-check` → `/code-review` → `/ccf:ccf-updatespec` sets `done`.

## Notes / best-practice sources
Defense-in-depth mirrors `plan-mode-guard.mjs ↔ ccf-plan.md` step 0 (`architecture.md`). Community/official guidance: subagents run with their OWN system prompt, so embedding rules in the agent body + restating them at delegation is the recommended combination ([#8395](https://github.com/anthropics/claude-code/issues/8395)).
