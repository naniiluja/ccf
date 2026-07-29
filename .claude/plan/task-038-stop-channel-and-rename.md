# Task 038 — Sửa chỗ nói sai về Stop, thêm chốt chống lặp, đổi tên hàm cho đúng nghĩa

- **Slice:** chạm `review-trace.mjs` là thư viện của hook LUÔN BẬT `plan-review-gate`, nên đây là task rủi ro nhất của iteration.
- **Depends on:** 037
- **Implemented by:** `ccf-implementer`, kèm `run_in_background: false`.
- **Model:** sonnet
- **Status:** in-review

## Goal (một câu)
Spec và chú thích ngừng nói sai về kênh phản hồi của sự kiện Stop, cổng SubagentStop có chốt chống lặp, và tên hàm ngừng khẳng định điều nó không chứng minh được.

## Vì sao task này an toàn dù chạm hook luôn bật
`tsconfig.json` bao `hooks/**/*.mjs` với `checkJs` và `strict`, nên import sai tên thành lỗi biên dịch TS2305 và bị cửa kiểm `tsc` bắt. File test bị loại khỏi `tsc` nhưng import sai ở đó làm `node --test` đỏ. Nếu hook vỡ thì mã thoát khác 2, mà theo `hooks.md` mã thoát 1 không chặn gì, nên hướng hỏng là cho qua chứ không phải treo.

## Đã làm

**Một, sửa chú thích `io.mjs`** (chỉ chú thích, không đụng thân hàm). Từ v2.1.163 Stop và SubagentStop ĐỀU nhận `hookSpecificOutput.additionalContext`; chú thích cũ nói ngược. Ba chỗ: danh sách sự kiện hợp lệ của `emitContext`; bỏ câu sai ở `emitSystemMessage`; viết lại LÝ DO của `blockSubagentStop`. Lý do mới có căn cứ: khi CHẶN một SubagentStop thì `additionalContext` của lượt đó bị BỎ, chỉ câu trả lời cuối của agent con tới được phiên cha, nên hình dạng chỉ `decision` và `reason` là CÓ CHỦ Ý.

**Hai, chốt chống lặp.** `lib/implementer-verify.mjs#shouldBlockImplementerStop` nhận thêm `stopHookActive`; `implementer-verify-gate.mjs` truyền `input.stop_hook_active`. Field vắng thì `Boolean(undefined)` là false nên hành vi KHÔNG đổi.

**ĐÁNH ĐỔI PHẢI GHI RÕ:** cổng này là **"HỎI MỘT LẦN", KHÔNG phải bảo đảm cưỡng chế**. Khi field CÓ tồn tại, lần stop thứ hai luôn được cho qua DÙ vẫn thiếu dòng `TEST-RESULT`. Đây là đánh đổi để tránh vòng lặp vô hạn. Đừng ai dựa vào nó như một bảo đảm. Đã ghi vào chú thích hàm, 3 README và `CLAUDE.md`.

**Ba, đổi tên `hasSpecCheckerReview` → `hasSpecCheckerSpawn`**, bỏ hẳn tên cũ (không giữ alias, vì tập nơi dùng là đóng nên alias sẽ thành mã chết). Lý do: hàm chỉ tìm khối `tool_use`, tức chứng minh đã GỌI agent, KHÔNG phải đã review XONG. Trước v2.1.198 hai điều đó trùng nhau vì agent chạy đồng bộ; nay không còn.

Sửa đủ **9 nhóm**: `review-trace.mjs` (định nghĩa + header + JSDoc), `plan-review-gate.mjs` 2 chỗ, `auto-verify.mjs` 2 chỗ, `review-trace.test.mjs` 17 chỗ, `verify-chain.mjs`, `commands/cook.md`, `.claude/rules/hooks.md` 2 chỗ, `CLAUDE.md`, và các câu nói sai mà việc đổi tên sinh ra để dẹp. Hai chỗ KHÔNG sửa vì là sổ sách lịch sử thật: `PLAN.md` và `task-028-*.md`.

## Test viết TRƯỚC, đã quan sát đỏ rồi mới xanh
`implementer-verify.test.mjs`: thêm ca `stopHookActive` true và thiếu dòng kết quả test → **21 pass / 1 fail**, đúng chỗ mong đợi. Sau khi sửa: **22 pass / 0 fail**. `review-trace.test.mjs`: đổi tên trước → đỏ bằng lỗi import → sửa nguồn → xanh.

## Cửa kiểm, kết quả thật
- `node --test`: **163 → 165 pass, 0 fail**.
- Smoke `implementer-verify-gate --enforce-tests` 3 ca: (a) thiếu `TEST-RESULT` + `stop_hook_active` false → in `{"decision":"block",...}`; (b) `stop_hook_active` true → im lặng exit 0; (c) field vắng → như ca (a).
- Smoke `plan-review-gate` 2 ca, để biến lời khai "hook luôn bật không đổi" thành quan sát thật: phiên `/ccf:plan` chưa review → `permissionDecision: "deny"`; phiên khác → cho qua. Hành vi GIỐNG HỆT trước khi đổi tên.
- `tsc --noEmit` exit 0 (đây chính là lưới bắt lỗi import sai của việc đổi tên).
- `hasSpecCheckerReview` còn 0 kết quả ngoài `.claude/plan/`.

## Bài học
Vòng review vòng hai bắt được: phiên implement đã hạ giọng đúng ở file lib nhưng lại NÂNG giọng ở header của hook, tạo ba câu khai mâu thuẫn về `transcript_path` cách nhau 28 dòng trong cùng một file. Đã thống nhất về một giọng `NOT YET OBSERVED`. Mọi khẳng định chưa quan sát trên harness này phải giữ giọng đó.
