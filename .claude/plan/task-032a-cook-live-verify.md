# Task 032a — Live post-reload verify của `/cook` (treo, HARD gate)

- **Vertical slice:** quan sát hành vi THẬT của `/cook` sau khi reload plugin — không viết code, chỉ verify + ghi bài học (independent green gate = driver right-size hợp lệ để tách khỏi 032).
- **Depends on:** 032.
- **Spec refs:** plan `~/.claude/plans/hi-n-t-i-c-v-n-zesty-pancake.md`, `.claude/rules/hooks.md` (`auto-verify.mjs` guard), memory [[ccf-plugin-runs-from-cache-not-repo]], [[slashcommand-tool-not-always-exposed]].
- **Implemented by:** user-driven (không phải `ccf-implementer`) — cần môi trường thật + reload plugin.
- **Gate (HARD close-gate, NOT waivable-without-observation):** phải QUAN SÁT được hành vi thật; mô phỏng 022a/024a/028a/029a/030a. Không đóng iteration cook-orchestrator + nested-spawn-guard khi 032a còn mở. KHÔNG chặn việc bắt đầu iteration/task khác (structural gate của 031/032 đã đủ).

## Goal (one sentence)
Xác nhận trên harness thật rằng `/cook` chạy đúng: implementer tuần tự bằng Sonnet 5 + KHÔNG nest-spawn, và chuỗi batch-verify chạy được (hoặc rơi fallback nhắc-tay) — ghi lại cơ chế invocation thật.

## Acceptance criteria (verifiable, observed)
- [ ] User reload plugin (`plugins/ccf` cache refresh) — xác nhận version/artefact-count mới (7 command) active.
- [ ] Chạy `/cook` trên 1 backlog NHỎ (1–2 task giả lập hoặc task thật nhỏ).
- [ ] Quan sát (a): implementer spawn **tuần tự** (không 2 cái song song), model **Sonnet 5** (kiểm nhãn/`resolvedModel`), và KHÔNG tự spawn agent con (nested-spawn bị chặn — hệ quả 031).
- [ ] Quan sát (b): batch-verify — `ccf-spec-checker` (Task) + `/code-review` chạy được song song HAY rơi fallback nhắc-tay; rồi `/simplify`; rồi re-gate; rồi `/ccf-updatespec`.
- [ ] **Ghi lại cơ chế invocation THẬT**: Skill tool hoạt động cho `/code-review`/`/simplify` không? SlashCommand có expose không? Nhánh nào thực sự chạy? → cập nhật `hooks.md`/`tooling.md`/memory nếu khác giả định.
- [ ] Ghi kết quả vào PLAN.md "Closed" của iteration; nếu hành vi khác plan → mở finding + task sửa.

## Test first
N/A — đây là quan sát live, không có artefact để test-first. "Verify" = chạy thật + ghi bằng chứng (transcript/nhãn model).

## Files to touch
- `.claude/plan/PLAN.md` — ghi kết quả observed vào Closed note khi 032a `done`
- (có điều kiện) `.claude/rules/hooks.md` / `tooling.md` / memory — nếu cơ chế invocation thật khác giả định

## Notes
- Plugin active chạy từ CACHE, không từ `D:\ccf` → mọi thay đổi 031/032 chỉ có hiệu lực sau reload ([[ccf-plugin-runs-from-cache-not-repo]]). Đây là lý do 032a treo.
- Cùng lứa live-verify treo cần reload: 022a (reach-MCP), 025a (Explore inject), 028a (auto-verify), 029a (effort), 030a (Kiro). Cân nhắc gom một lần reload để quan sát nhiều gate.
