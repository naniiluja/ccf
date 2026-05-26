---
description: Convention code JS/Node và markdown trong dự án plugin CCF.
---

# Coding conventions

## JavaScript / Node (`*.mjs`)
- **ESM thuần**: `import ... from "node:..."`. Luôn prefix `node:` cho built-in module.
- **JSDoc bắt buộc** cho mọi hàm export và hàm có tham số: `@param`/`@returns` với kiểu — vì `tsconfig.json` bật `checkJs` + `strict`, type sai sẽ fail `tsc` (xem cách chạy `tsc` kèm tiền điều kiện `@types/node` ở `testing.md`).
- Hàm thuần nhỏ, một trách nhiệm. Helper dùng chung (vd I/O hook) đặt ở `hooks/lib/` và import lại — DRY, không copy-paste contract stdin/stdout.
- Đặt tên rõ nghĩa (`findInProgressTask`, `specsOlderThanCode`); không viết tắt khó hiểu.
- Comment giải thích **tại sao** (vd "tránh treo khi không có stdin"), không lặp lại cái code đã nói.
- Ép kiểu đầu vào ngoài tầm kiểm soát: `String(input.x ?? "")`, `Number(...)` — không tin dữ liệu stdin.

## Markdown (command / agent / rule / template)
- Frontmatter YAML hợp lệ, đúng các field cho từng loại (xem `components.md`).
- Heading phân cấp rõ; command/agent dùng heading đánh số bước.
- Câu lệnh hướng Claude viết ở thể mệnh lệnh, dứt khoát (vd "DỪNG.", "KHÔNG commit").
- Giữ ngắn gọn, mỗi câu thêm thông tin mới — đây là context Claude phải nạp, dài = tốn token + loãng.

## Ngôn ngữ
- Toàn bộ prose (comment, prompt, rule) bằng **tiếng Việt có dấu đầy đủ**. Giữ nguyên định danh kỹ thuật (tên tool, field, command) ở dạng gốc.

## Nguyên tắc thiết kế (áp dụng mọi thay đổi)
- **KISS**: chọn giải pháp đơn giản nhất chạy được; hook ưu tiên heuristic nhẹ hơn là phân tích nặng.
- **YAGNI**: chỉ thêm rule/command/field khi có nhu cầu thật. Không sinh rule rỗng cho thứ không áp dụng (vd dự án này KHÔNG có data-layer/api/component rule).
- **DRY**: contract hook ở một chỗ (`io.mjs`); convention ở `.claude/rules/`, không nhắc lại trong từng prompt.
- **SRP**: một file một trách nhiệm.
