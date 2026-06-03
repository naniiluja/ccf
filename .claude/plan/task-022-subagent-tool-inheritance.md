# Task 022 — 6 subagents inherit the project's tool/MCP/skill set

- **Vertical slice:** behavior — switch every CCF subagent from a static `tools` allowlist to inheritance so it can reach the host project's arbitrary MCP servers (oracle, chrome-devtools, …) + project skills. The writer (`ccf-implementer`) omits `tools` (inherit-all); the 5 read-only agents use `disallowedTools: Write, Edit, NotebookEdit` (inherit-all-minus-file-writes, preserving their non-writing mandate + analyzer 5-parallel safety). End-to-end tracer: a spawned subagent can list + call a project MCP tool that the old allowlist hid.
- **Depends on:** — (head of queue).
- **Spec refs:** `components.md` (agent frontmatter, least-privilege — this task REWRITES that convention in 023), `architecture.md` ("Agent context & rule propagation"; "Command ↔ agent boundary" parallel-read-only law). Grounding (Context7 `/websites/code_claude`, `code.claude.com/docs/en/sub-agents` + `/en/tools-reference`, done at planning): inheritance contract (neither field → inherit-all incl. MCP; `tools` allowlist BLOCKS MCP+Skill; `disallowedTools` → inherit-minus; `mcpServers`/`permissionMode`/`hooks` "Ignored for plugin subagents" but default inheritance still applies; session-state tools never reach subagents → no nested spawn; runtime permission prompts gate each call). Memory: [[ground-claude-facts-primary-not-blog]], [[ccf-plugin-runs-from-cache-not-repo]], [[output-style-not-inherited-by-subagents]].
- **Implemented by:** ccf-implementer. **Test discipline:** off (frontmatter/prose slice — verify by grep + validate-smoke + tsc + re-read + dogfood-mechanism).
- **Gate (GREEN before 023):**
  - `disallowedTools` field-validity is GROUNDED via the docs "Supported frontmatter fields" list (cite) — NOT proven by `claude plugin validate`.
  - `claude plugin validate plugins/ccf` = SMOKE only (it validates the manifest `plugin.json`, NOT agent frontmatter — confirmed it passes regardless). Run only to confirm the manifest is not broken.
  - **GO/NO-GO = dogfood-mechanism in MAIN session:** spawn a generic agent → have it list its tools + call one project MCP (`mcp__oracle_connect__*` / chrome-devtools `list_pages`) → confirm a subagent inherits the main loop's project MCP. + a tool-restricted-context check for the substitutability risk.
  - `grep`: `ccf-implementer.md` has NO `^tools:` line; the 5 read-only agents each have `disallowedTools: Write, Edit, NotebookEdit`; no read-only agent retains a `^tools:` allowlist.
  - `npx -p typescript tsc --noEmit` exit 0; cross-read 6 files for valid frontmatter + coherent body.

## Goal (one sentence)
Every CCF subagent inherits the host project's full tool/MCP/skill set (writer inherit-all; read-only inherit-all-minus-file-writes), so they can use project-arbitrary MCP + skills — with NO artifact-count change (6/6/6/1).

## Acceptance criteria (verifiable)
- [ ] `ccf-implementer.md`: the `tools:` frontmatter line is REMOVED (frontmatter keeps `name`/`description`/`model`). Body step 3 generalized: "use whatever DB/library MCP the project provides (Supabase, Oracle, Context7, MS Learn, …); you MAY invoke the project's own skills via the **Skill tool** when relevant — do NOT guess."
- [ ] `ccf-debugger.md`: `tools:` → `disallowedTools: Write, Edit, NotebookEdit`. Body step 3: "if the project has a DB MCP (Supabase/Oracle/…)" — keep "read-only SELECT, NEVER mutate".
- [ ] `ccf-codebase-analyzer.md`: `tools:` → `disallowedTools: Write, Edit, NotebookEdit` (body keeps "must NOT write files").
- [ ] `ccf-best-practice-researcher.md`: `tools:` → `disallowedTools: Write, Edit, NotebookEdit`. Add one line noting `WebFetch` (used by its body fallback) is a default tool, still inherited unless the host denies it.
- [ ] `ccf-spec-checker.md`: `tools: Read, Glob, Grep, Bash` → `disallowedTools: Write, Edit, NotebookEdit`.
- [ ] `ccf-spec-writer.md`: `tools: Read, Glob` → `disallowedTools: Write, Edit, NotebookEdit` (keeps "returns content, main thread writes").
- [ ] Each of the 5 read-only agents states a uniform READ-ONLY mandate in its body: "You are READ-ONLY: do not write files, and do not mutate any external system via MCP (SELECT/read only)."
- [ ] `ccf-implementer.md` + `ccf-debugger.md` bodies note that an inherited project MCP tool may be lazily loaded → use `ToolSearch` to load its schema before calling (surfaced by the dogfood: project MCP arrives as a deferred tool; calling blind fails with InputValidationError).
- [ ] NO artifact-count change: 6 cmd / 6 agent / 6 hook / 1 skill; `plan-review-gate.mjs` / `review-trace.mjs` / `agent-rules-inject.mjs` untouched.

## Test first (write before implementing)
N/A (frontmatter/prose slice). The "failing test" stated first: BEFORE, a subagent spawned with the old `tools` allowlist CANNOT see/call a project MCP (oracle/chrome-devtools) and has no Skill tool; AFTER, a spawned subagent inherits the main loop's project MCP + Skill (proven by the dogfood-mechanism spawn), and grep shows the new frontmatter on all 6 agents. Verify BOTH states.

## Files to touch
- `plugins/ccf/agents/ccf-implementer.md`
- `plugins/ccf/agents/ccf-debugger.md`
- `plugins/ccf/agents/ccf-codebase-analyzer.md`
- `plugins/ccf/agents/ccf-best-practice-researcher.md`
- `plugins/ccf/agents/ccf-spec-checker.md`
- `plugins/ccf/agents/ccf-spec-writer.md`

## Steps (thin end-to-end slice)
1. Re-read each agent's current frontmatter (analyzer/researcher tools not yet read exactly).
2. Edit `ccf-implementer.md` (remove `tools:`, generalize body step 3 + Skill note).
3. Edit the 5 read-only agents (`tools:` → `disallowedTools: Write, Edit, NotebookEdit` + uniform READ-ONLY body line + the researcher WebFetch note + debugger Oracle generalization).
4. grep frontmatter; `claude plugin validate` (smoke); `tsc --noEmit`; cross-read for SRP.
5. **DOGFOOD-mechanism (MAIN session, not inside the implementer):** spawn a generic agent → it lists tools + calls one project MCP → confirm subagent inherits project MCP.
6. Mark `in-review` (NOT `done`). 023 starts only after this gate is GREEN.

## Notes / best-practice sources
The allowlist is the ROOT CAUSE of MCP/Skill blindness (grounded: `tools` allowlist "prevents using MCP tools"). For a plugin subagent there is no way to list unknown-at-authoring-time project MCP, so inheritance (omit/`disallowedTools`) is the ONLY mechanism. Read-only safety is preserved by the file-write denial + runtime permission prompts. Real effect needs a plugin reload (active plugin runs from the v0.3.4 cache, [[ccf-plugin-runs-from-cache-not-repo]]) → the post-reload live spawn is tracked as a separate `022a` row in PLAN.md, blocking `done`.
