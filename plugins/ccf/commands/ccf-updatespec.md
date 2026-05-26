---
description: Refresh CCF spec (.claude/rules + CLAUDE.md) với những gì học được trong session, để session sau có context tươi. Ghi cả công cụ mới kèm "dùng khi nào".
argument-hint: ""
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Task
model: opus
---

Bạn đang chạy CCF `/ccf-updatespec`. Mục tiêu: cô đọng bài học của session này vào spec, để session sau khởi đầu với context tươi.

## Các bước

### 1. Reflect
Rà soát session này để tìm bài học: đổi pattern giữa chừng, lỗi mà bạn (Claude) đã mắc và cách sửa, bug + root cause, convention hóa ra sai/thiếu, gotcha/lệnh mới phát hiện. Liệt kê ra.

### 2. Định vị spec
Tìm mọi `CLAUDE.md` + `.claude/rules/*` (root + nested). Mỗi bài học thuộc về file gần cwd nhất; bài học theo path → rule có frontmatter `paths:`.

### 3. Cập nhật modular
- Viết bài học thành **rule cụ thể, verifiable**.
- Mỗi rule file < 50 dòng, một topic; tạo `.claude/rules/<topic>.md` mới nếu chưa có file phù hợp + thêm dòng `@.claude/rules/<topic>.md` vào CLAUDE.md liên quan.
- Giữ mọi CLAUDE.md < 200 dòng (có thể giao `ccf-spec-writer` draft qua Task).
- **Show diff + một dòng "vì sao"** trước khi ghi, rồi mới Edit/Write.

### 4. Ghi lại công cụ mới (quan trọng)
Nếu session này có thêm **skill / MCP server / subagent / tool** mới (vd người dùng cài MCP Supabase, thêm một skill), ghi vào `.claude/rules/tooling.md` **kèm giải thích DÙNG TRONG TRƯỜNG HỢP NÀO** — trigger cụ thể, input/output, ví dụ — để agent ở session sau tự biết khi nào nên gọi. Đây là cốt lõi context-first: spec không chỉ nói có gì mà nói **dùng khi nào**.

### 5. Sync plan
Nếu `.claude/plan/` thay đổi (task xong, đổi thứ tự, thêm mới), cập nhật `PLAN.md` và status từng task.

## Kết thúc (bắt buộc, đúng output style)
HỎI người dùng có muốn commit và/hoặc push không. **KHÔNG chạy bất kỳ lệnh git nào khi người dùng chưa đồng ý rõ ràng.** Nếu đồng ý: nếu đang ở branch mặc định thì tạo branch trước, dùng commit message conventional.
