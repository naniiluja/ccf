# Task 034a — Live post-reload verify SubagentStop gate (TREO, HARD close-gate + PREDECESSOR CỨNG của việc BẬT hook)

- **Vertical slice:** quan sát hành vi THẬT sau reload (independent green gate = driver right-size hợp lệ để tách khỏi 034). Không viết code.
- **Depends on:** 034.
- **Spec refs:** `.claude/rules/hooks.md` (SubagentStop entry), memory [[ccf-plugin-runs-from-cache-not-repo]]; plan Phần 3.
- **Implemented by:** user-driven (KHÔNG phải `ccf-implementer`) — cần môi trường thật + reload plugin.
- **Ràng buộc CƠ CHẾ (fold ❌#2 + premortem-H 024a):** `--enforce-tests` **mặc-định-TẮT** và `hooks.md` ghi "không bật cho tới khi 034a quan sát xong". Vì vậy dù 034a bị đóng bằng user-acceptance-không-quan-sát (bài học 024a, PLAN.md:118), toggle vẫn off → KHÔNG gây loop thật. Việc BẬT hook thực tế là HỆ QUẢ của 034a, không phải trước nó.
- **Gate (HARD close-gate, NOT waivable-without-observation):** phải QUAN SÁT payload + loop-termination thật; mô phỏng 022a/024a/028a/029a/030a/032a. Không đóng iteration khi 034a mở; KHÔNG chặn task khác.

## Goal (one sentence)
Xác nhận trên harness thật rằng `SubagentStop` fire với matcher `ccf-implementer`, quan sát payload thật (`transcript_path`? `stop_hook_active`?) và loop tự-kết-thúc khi implementer tái nêu `TEST-RESULT:` — hoặc revert toggle nếu không loop-safe.

## Acceptance criteria (verifiable, observed)
- [ ] User reload plugin → count **9 hook** active.
- [ ] Bật `--enforce-tests` trong `hooks.json`, spawn `ccf-implementer` thật cho 1 task nhỏ CÓ test surface.
- [ ] Quan sát payload: `SubagentStop` fire với matcher `ccf-implementer`? `transcript_path` có mặt? **`stop_hook_active` có mặt?** → nếu CÓ `stop_hook_active` → wire làm guard chính (mở finding sửa 034); nếu VẮNG → giữ `--enforce-tests` VÔ HIỆU HÓA VĨNH VIỄN (ghi `hooks.md`).
- [ ] Quan sát loop-termination: implementer thiếu evidence → block → chạy test → tái nêu `TEST-RESULT:` → được stop (tự-kết-thúc). Nếu loop → revert toggle + finding.
- [ ] Chụp `last_assistant_message` THẬT làm fixture → điền vào test detector của 034 (đóng khoảng cách synthetic-vs-thật, bài học `isFailureText`).
- [ ] Cập nhật `hooks.md`/memory nếu payload khác giả định; ghi Closed note.

## Test first
N/A — quan sát live, không có artefact để test-first. "Verify" = chạy thật + ghi bằng chứng (payload/transcript).

## Files to touch
- `.claude/plan/PLAN.md` — ghi kết quả observed vào Closed note khi 034a `done`
- (điều kiện) `.claude/rules/hooks.md` / memory / `implementer-verify.test.mjs` fixture — nếu payload thật khác giả định

## Notes
- Plugin active chạy từ CACHE → mọi thay đổi 034 chỉ hiệu lực sau reload ([[ccf-plugin-runs-from-cache-not-repo]]). Đây là lý do 034a treo.
- Cùng lứa live-verify treo cần reload: 022a, 025a, 028a, 029a, 030a, 032a. Cân nhắc gom một lần reload để quan sát nhiều gate.
