# Task 023 — Spec + docs sync for subagent tool/MCP/skill inheritance

- **Vertical slice:** docs — document the new convention (subagents inherit the project's tool/MCP/skill set via omit/`disallowedTools`) everywhere the agent tool-policy is described, and REWRITE the stale least-privilege-allowlist rule so the spec is self-consistent. No artifact-count change.
- **Depends on:** 022.
- **Spec refs:** `components.md:14`+`:17` (the contradicted rule), `architecture.md` ("Agent context & rule propagation" + "Command ↔ agent boundary"), `tooling.md` ("Convention for adding a new tool"), 3 READMEs (`:61` least-privilege line + agent table), `plugins/ccf/README.md`, `CLAUDE.md`, `PLAN.md`. Memory link family: [[output-style-not-inherited-by-subagents]], [[ccf-plugin-runs-from-cache-not-repo]], [[ground-claude-facts-primary-not-blog]].
- **Implemented by:** ccf-implementer. **Test discipline:** off (prose slice — verify by grep-consistency + validate + tsc + node --test regression + re-read).
- **Gate (closes iteration):**
  - `grep`-consistency: the new convention (`disallowedTools` / "inherit" / "project MCP") is consistent across `components.md`, `architecture.md`, `tooling.md`, 3 READMEs, `plugins/ccf/README.md`, `CLAUDE.md`; the OLD least-privilege-agent-tools claim is REWRITTEN/REMOVED — grep confirms `components.md` (old lines 14+17) + `README.md`/`.vi`/`.zh-CN` (old line 61 "least-privilege tools"/"最小权限的工具") no longer assert agent tools must be a least-privilege allowlist. Counts stay 6/6/6/1.
  - `claude plugin validate plugins/ccf` passed; `npx -p typescript tsc --noEmit` exit 0; `node --test plugins/ccf/hooks/lib/*.test.mjs` all green (regression); cross-read.

## Goal (one sentence)
Document the subagent inheritance convention in every place that describes agent tool-policy, rewrite the contradicted least-privilege rule into ONE coherent policy, and record the iteration in PLAN.md (incl. the `022a` post-reload verify row) — counts unchanged (6/6/6/1).

## Acceptance criteria (verifiable)
- [ ] `components.md`: rewrite BOTH line 14 (`tools` … least-privilege) AND line 17 ("A read-only agent MUST declare only read-only tools") into a SINGLE coherent policy: subagents inherit the project's tool/MCP/skill set; WRITER omits `tools` (inherit-all), read-only uses `disallowedTools: Write, Edit, NotebookEdit`; `tools` allowlist blocks project MCP+Skill (grounded); `mcpServers`/`permissionMode`/`hooks` ignored for plugin subagents; safety = permission-runtime + file-write denial; note the "inherited-baseline assumption". Keep COMMAND `allowed-tools` least-privilege (different scope).
- [ ] `architecture.md`: "Agent context & rule propagation" gains a tool/MCP/skill inheritance bullet; "Command ↔ agent boundary" affirms parallel-read-only-research still holds (file-safe) but notes parallel DB-write via project MCP is now possible (rare + permission-gated).
- [ ] `tooling.md`: "Convention for adding a new tool" notes project-arbitrary MCP reaches subagents via inheritance, not by listing in `tools`; and that an inherited MCP tool may be lazily loaded (subagent uses `ToolSearch` to load its schema before calling) — surfaced by the 022 dogfood.
- [ ] `README.md` + `README.vi.md` + `README.zh-CN.md`: a note near the agent table that subagents inherit the project's MCP + skills (read-only agents cannot write files); AND the line-61 "least-privilege tools"/"最小权限的工具" claim is rewritten (not left to contradict). The parallelism-read-only half of line 61 is preserved.
- [ ] `plugins/ccf/README.md`: agent tool description updated if present.
- [ ] `CLAUDE.md`: "Current plan" → iteration 022–023; architecture line about agents reflects inheritance. Counts stay 6/6/6/1.
- [ ] `PLAN.md`: add "## Origin — subagent-tool-inheritance (tasks 022–023)" + backlog table including an INDEPENDENT `022a` row for the post-reload live-spawn verify (`status: todo` — a pending, not-yet-started step awaiting the user's plugin reload; depends 023) — a distinct table row, NOT a status-note in row 022's cell, so the Stop-hook `findNonDoneTasks` sees a not-done row after 022/023 complete. Do NOT touch 017–019 / 020–021 sections.
- [ ] Scope-exclusion respected: `templates/**` NOT touched (templates ship no subagents); `agent-rules-inject.mjs`/hooks NOT touched (orthogonal — additionalContext, not `tools`).

## Test first (write before implementing)
N/A (prose slice). The "failing test" stated first: BEFORE, grep finds the old least-privilege-allowlist claim at `components.md:14/17` + `README*:61` AND no mention of inheritance/`disallowedTools` → spec contradicts the 022 behavior; AFTER, grep finds the inheritance convention consistently and finds NO surviving least-privilege-agent-tools assertion. Verify BOTH states.

## Files to touch
- `.claude/rules/components.md`
- `.claude/rules/architecture.md`
- `.claude/rules/tooling.md`
- `README.md`, `README.vi.md`, `README.zh-CN.md`
- `plugins/ccf/README.md`
- `CLAUDE.md`
- `.claude/plan/PLAN.md`

## Steps (thin end-to-end slice)
1. Rewrite `components.md` 14+17 into one policy (most important — the contradicted rule).
2. Update `architecture.md`, `tooling.md`.
3. Update 3 READMEs (note + line-61 rewrite, preserving the parallelism half) + `plugins/ccf/README.md` + `CLAUDE.md`.
4. Update `PLAN.md` (Origin + backlog + `022a` row).
5. grep-consistency; `validate`; `tsc`; `node --test` regression; cross-read.
6. Mark `in-review` (NOT `done`).

## Notes / best-practice sources
This is the anti-drift task: the premortem (#3) anchors to the 005–009 README count-drift, so the gate must verify the OLD sentence is gone, not merely that a new one was added. The `022a` row is the explicit, status-bearing reminder that the real proof needs a plugin reload — modeled on how 017's live-check is still held in `in-review`.
