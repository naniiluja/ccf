# Task 031 — Nested-spawn guard (agent frontmatter + spec reconcile)

- **Vertical slice:** thêm `Agent, Task` vào `disallowedTools` của cả 6 agent + prose backup + sửa spec-sai "no nested spawn" ở 2 rule + doc sync (một mối lo cố kết: chặn subagent tự đẻ agent con, right-sized).
- **Depends on:** — (lead task của iteration cook-orchestrator + nested-spawn-guard). Lấy baseline = trạng thái frontmatter SAU 022-023 (in-review, chưa commit); re-base nếu 022-023 revert.
- **Spec refs:** `.claude/rules/architecture.md` (§Agent context & rule propagation, §Command↔agent boundary), `.claude/rules/components.md` (§Agent tool policy), `CLAUDE.md`, plan `~/.claude/plans/hi-n-t-i-c-v-n-zesty-pancake.md` (approved, review 2× READY).
- **Implemented by:** `ccf-implementer` (alias `sonnet` = Sonnet 5), session sạch + MCP `context7` (re-ground `/websites/code_claude` `/sub-agents` "denylist" trước khi ghi wording spec mới).
- **Gate (must be GREEN before task 032):** grep frontmatter 6/6 có `Agent, Task` trong `disallowedTools` + `claude plugin validate plugins/ccf` exit 0 + `node --test plugins/ccf/hooks/lib/*.test.mjs` 134/134 baseline + `npx -p typescript tsc --noEmit` exit 0 + grep-consistency (không còn câu "spawn tools never reach a subagent").

## Goal (one sentence)
Chặn xác định việc subagent tự spawn agent con (grounded: nested-spawn CÓ, depth 5, tool `Agent`/`Task` kế thừa) bằng `disallowedTools`, đồng thời sửa câu spec sai khẳng định điều ngược lại.

## Acceptance criteria (verifiable)
- [ ] `ccf-implementer.md`: đổi từ OMIT `tools` → `disallowedTools: Agent, Task` (VẪN inherit-all-trừ-spawn: Write/Edit/MCP/Skill còn nguyên — đây là ràng buộc phải giữ, không được mất quyền ghi file / MCP).
- [ ] 5 agent read-only (`ccf-codebase-analyzer`, `ccf-best-practice-researcher`, `ccf-spec-checker`, `ccf-spec-writer`, `ccf-debugger`): nối `Agent, Task` vào denylist sẵn có → `disallowedTools: Write, Edit, NotebookEdit, Agent, Task`.
- [ ] Body cả 6 agent thêm 1 câu prose backup: "Do NOT spawn other agents (Task/Agent tool) — you are a leaf; return your result to the caller." (defense-in-depth như `plan-mode-guard ↔ ccf-plan` step 0).
- [ ] `architecture.md` §Agent context & rule propagation: sửa câu "Session-state/spawn tools never reach a subagent → no nested spawn" thành sự thật grounded: "A subagent CAN spawn nested subagents (depth ≤ 5) — the `Agent`/`Task` tool is inherited; CCF blocks it deterministically via `disallowedTools: Agent, Task` on all 6 agents (a leaf-agent invariant)." Sửa cả câu tương tự ở §Command↔agent boundary nếu có.
- [ ] `components.md` §Agent (mục tool policy, khoảng dòng 18): sửa câu "session-state/spawn tools never reach a subagent" tương ứng; nêu rõ `disallowedTools` chặn được cả tool file-write LẪN spawn tool.
- [ ] `CLAUDE.md` "Current plan" sync (lead iteration = cook-orchestrator + nested-spawn-guard); artifact-count KHÔNG đổi (6/6/8/1) ở task này.
- [ ] `.claude/plan/PLAN.md`: mark 031 `in-review` khi xong.

## Test first (write before implementing)
Không có `.mjs`/executable trong task này (thuần markdown frontmatter) — "test first" = viết trước các lệnh verify dưới, xác nhận chúng FAIL trên trạng thái hiện tại (chưa có `Agent, Task`) trước khi pass.
1. `grep -l "Agent, Task" plugins/ccf/agents/*.md` — trước khi sửa: 0 file; sau: 6 file.
2. `grep -rn "spawn tools never reach" .claude/rules/` — trước: có hit; sau: 0 hit.

## Files to touch
- `plugins/ccf/agents/ccf-implementer.md` — frontmatter OMIT→`disallowedTools: Agent, Task` + body 1 câu
- `plugins/ccf/agents/ccf-codebase-analyzer.md` — nối `Agent, Task` + body 1 câu
- `plugins/ccf/agents/ccf-best-practice-researcher.md` — nối `Agent, Task` + body 1 câu
- `plugins/ccf/agents/ccf-spec-checker.md` — nối `Agent, Task` + body 1 câu
- `plugins/ccf/agents/ccf-spec-writer.md` — nối `Agent, Task` + body 1 câu
- `plugins/ccf/agents/ccf-debugger.md` — nối `Agent, Task` + body 1 câu
- `.claude/rules/architecture.md` — sửa câu spec-sai (2 chỗ)
- `.claude/rules/components.md` — sửa câu spec-sai (mục tool policy)
- `CLAUDE.md` — "Current plan" sync
- `.claude/plan/PLAN.md` — mark 031 `in-review`

## Steps (thin end-to-end slice)
1. Re-ground: Context7 `/websites/code_claude` `/sub-agents` — xác nhận (a) nested spawn depth 5, (b) `disallowedTools: Agent`/`Task` chặn spawn kể cả inherit-all. Ghi drift nếu có.
2. Chạy verify command (grep) trên trạng thái hiện tại, xác nhận FAIL đúng như kỳ vọng.
3. Sửa 6 agent frontmatter + body.
4. Sửa 2 rule (câu spec-sai) — dùng wording grounded từ bước 1.
5. Chạy lại grep + `claude plugin validate plugins/ccf` + `npx -p typescript tsc --noEmit` + `node --test plugins/ccf/hooks/lib/*.test.mjs` — tất cả phải xanh.
6. Sync `CLAUDE.md` "Current plan"; mark 031 `in-review` (KHÔNG `done`).
7. `/ccf:ccf-check` → `/code-review` → `/ccf:ccf-updatespec` — `done` chỉ set ở đây sau review sạch.

## Notes / best-practice sources
- Context7 `/websites/code_claude` `/sub-agents` ("Spawn nested subagents", "Restrict sub-agent tools with a denylist"), `/agent-sdk/subagents` ("Nested Subagents", depth 5). Point-in-time — re-verify per step 1.
- **KHÔNG agent nào hiện tự spawn** (đã grep body 6 agent: 0 tham chiếu Task/Agent/spawn/delegate) → thêm chặn an toàn, không phá hành vi hiện tại. `/ccf-fix` spawn debugger + `/ccf-init` spawn analyzer là từ MAIN loop, không phải agent tự đẻ.
- Memory: [[subagent-inherits-project-mcp-via-disallowedtools]], [[ground-claude-facts-primary-not-blog]], [[ccf-plugin-runs-from-cache-not-repo]].
