---
description: Cách verify thay đổi trong plugin CCF — hiện trạng và mức kỳ vọng.
---

# Testing & verification

## Hiện trạng (trung thực)
- Dự án CHƯA có test framework / test tự động. `package.json` không có script `test`.
- Phần deterministic duy nhất là **hook `.mjs`** — đây là thứ đáng test nhất nếu thêm test sau này.
- Component (command/agent/template) là prompt; "đúng" được verify bằng đọc + chạy thử trong Claude Code, không bằng unit test.

## Cách verify đang dùng
- **Type-check**: `npm install` (một lần) rồi `npx tsc --noEmit` (cấu hình ở `tsconfig.json`, `checkJs` + `strict`) — bắt lỗi kiểu trong hook/bin. Chạy trước khi coi một thay đổi hook là xong. Hiện trạng đã verify: `tsc` xanh (exit 0).
  - **Lưu ý dependency**: `tsconfig.json` đặt `"types": ["node"]` nên cần `@types/node` (đã có trong `devDependencies`). Đây là **devDependency chỉ phục vụ type-check**, KHÔNG phải runtime dependency — không vi phạm bất biến "hook no-dependency lúc chạy". Tuyệt đối KHÔNG thêm dependency runtime.
- **Smoke hook thủ công**: pipe JSON giả lập stdin vào hook, kiểm stdout/exit code. Ví dụ:
  - `'{"prompt":"/ccf:ccf-plan","permission_mode":"default"}' | node plugins/ccf/hooks/plan-mode-guard.mjs` → kỳ vọng exit 2 + thông báo ra stderr.
  - `'{"source":"startup","cwd":"."}' | node plugins/ccf/hooks/session-start.mjs` → kỳ vọng stdout JSON có `additionalContext`.
- **Cài thử local**: `claude plugin marketplace add D:/projects/ccf` + `install` rồi chạy thử các `/ccf:*`.

## Kỳ vọng khi thay đổi hook
- Hook PHẢI không bao giờ crash với input rỗng/sai (đã đảm bảo qua `io.mjs`); thay đổi không được phá bất biến này.
- Nếu thêm logic phân nhánh đáng kể vào hook, cân nhắc thêm test runner thuần Node (vd `node --test`, built-in, không thêm dependency — phù hợp luật no-dep). Viết failing test trước theo workflow CCF.

## Verification-first (luật CCF)
Với bất kỳ thay đổi hành vi nào: xác định cách verify TRƯỚC khi sửa. Với prompt/command, "verify" là kịch bản chạy thử cụ thể; với hook, là `tsc` + smoke input. Báo kết quả thật, không tuyên bố "đã test" khi chưa chạy.
