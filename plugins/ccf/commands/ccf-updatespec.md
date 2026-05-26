---
description: Refresh CCF spec (.claude/rules + CLAUDE.md) VÀ memory hệ thống với những gì học được trong session, để session sau có context tươi và bớt lặp lỗi. Ghi cả công cụ mới kèm "dùng khi nào".
argument-hint: ""
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Task
model: opus
---

Bạn đang chạy CCF `/ccf-updatespec`. Mục tiêu: cô đọng bài học của session này vào **hai nơi** — spec dự án (`.claude/`) và memory hệ thống của Claude Code — để session sau khởi đầu với context tươi và Claude bớt lặp lỗi.

> **Vì sao hai nơi (quan trọng — quyết định ghi cái gì vào đâu):**
> - **Spec** (`CLAUDE.md` + `.claude/rules/`) được nạp như *user message*, bị gắn nhãn "có thể không liên quan" → trọng số thấp hơn. Hợp để ghi **rule dự án**: convention, architecture, tech-stack, tooling.
> - **Memory** (`~/.claude/projects/<path>/memory/`) được nạp vào *system prompt*, **không bị giảm trọng số** → Claude tuân theo mạnh hơn. Hợp để ghi **feedback chống lỗi** và **user preference** xuyên session.
> - **KHÔNG trùng lặp:** thứ gì đã ở CLAUDE.md thì ĐỪNG chép lại vào memory. Nếu một rule trong CLAUDE.md hay bị quên/làm sai, viết một `feedback` memory để *gia cố* nó (nêu rõ vì sao), thay vì lặp lại nội dung.

## Các bước

### 1. Reflect & phân loại
Rà soát session này để tìm bài học, rồi phân loại mỗi cái thuộc **spec** hay **memory**:
- → **Spec**: convention/pattern dự án, architecture, tech-stack, công cụ mới (rule có thể suy ra từ code hoặc thuộc về repo).
- → **Memory (`feedback`)**: lỗi mà bạn (Claude) đã mắc + cách sửa, *và cả cách làm đúng đã được người dùng xác nhận* — để không trôi dạt khỏi hướng đã validate.
- → **Memory (`user`)**: sở thích/cử chỉ/cách làm việc người dùng thể hiện (vd "luôn dùng X", "đừng tự ý refactor").
- → **Memory (`project`)**: ràng buộc dự án không suy ra được từ code/git (deadline, freeze...). Đổi ngày tương đối thành ngày tuyệt đối.
- KHÔNG ghi vào memory: thứ suy ra được từ code, git history, hay đã có trong CLAUDE.md; tiến độ task tạm thời (dùng plan).

### 2. Định vị spec
Tìm mọi `CLAUDE.md` + `.claude/rules/*` (root + nested). Mỗi bài học thuộc về file gần cwd nhất; bài học theo path → rule có frontmatter `paths:`.

### 3. Cập nhật modular
- Viết bài học thành **rule cụ thể, verifiable**.
- Mỗi rule file < 50 dòng, một topic; tạo `.claude/rules/<topic>.md` mới nếu chưa có file phù hợp + thêm dòng `@.claude/rules/<topic>.md` vào CLAUDE.md liên quan.
- Giữ mọi CLAUDE.md < 200 dòng (có thể giao `ccf-spec-writer` draft qua Task).
- **Show diff + một dòng "vì sao"** trước khi ghi, rồi mới Edit/Write.

### 4. Ghi lại công cụ mới (quan trọng)
Nếu session này có thêm **skill / MCP server / subagent / tool** mới (vd người dùng cài MCP Supabase, thêm một skill), ghi vào `.claude/rules/tooling.md` **kèm giải thích DÙNG TRONG TRƯỜNG HỢP NÀO** — trigger cụ thể, input/output, ví dụ — để agent ở session sau tự biết khi nào nên gọi. Đây là cốt lõi context-first: spec không chỉ nói có gì mà nói **dùng khi nào**.

### 5. Cập nhật memory hệ thống (chống lỗi xuyên session)
Với các bài học đã phân loại thuộc **memory** ở bước 1, ghi vào thư mục memory của dự án này: `~/.claude/projects/<sanitized-project-path>/memory/`.
- Mỗi memory là **một file** giữ **một fact**, có frontmatter `name` (kebab-case), `description` (một dòng — dùng để recall), `metadata.type` (`feedback` | `user` | `project` | `reference`).
- Với `feedback`/`project`: body theo sau bằng dòng `**Why:**` và `**How to apply:**` (có "vì sao" để Claude tự xử lý edge case sau này).
- Trước khi tạo mới, **kiểm tra file đã tồn tại** che cùng nội dung → cập nhật file đó thay vì tạo trùng; xóa memory hóa ra sai.
- Sau khi ghi file, thêm **một dòng** trỏ vào `MEMORY.md` (`- [Tiêu đề](file.md) — hook`). MEMORY.md chỉ là index (một dòng/memory, < ~200 ký tự), KHÔNG đặt nội dung memory ở đó. Liên kết memory liên quan bằng `[[tên-file]]`.
- Memory nhắc tới file/hàm/flag cụ thể: ưu tiên mô tả không phụ thuộc dòng (vd "auth qua middleware ở main.go" thay vì "dòng 42").

### 6. Sync plan
Nếu `.claude/plan/` thay đổi (task xong, đổi thứ tự, thêm mới), cập nhật `PLAN.md` và status từng task.

## Kết thúc (bắt buộc, đúng output style)
HỎI người dùng có muốn commit và/hoặc push không. **KHÔNG chạy bất kỳ lệnh git nào khi người dùng chưa đồng ý rõ ràng.** Nếu đồng ý: nếu đang ở branch mặc định thì tạo branch trước, dùng commit message conventional.
