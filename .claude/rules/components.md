---
description: Quy ước viết command, agent và template của plugin CCF (artifact markdown).
---

# Components (command / agent / template)

## Command (`commands/*.md`)
- Frontmatter hợp lệ: `description` (action-oriented, ngắn), `argument-hint` (vd `"[mô tả lỗi]"`), `allowed-tools` (whitelist; KHÔNG để command thừa kế toàn bộ tool), `model` (`opus`/`sonnet`/`haiku`).
- `allowed-tools` phải tối thiểu đủ dùng. MCP tool ghi đầy đủ namespace (vd `mcp__context7__query-docs`, `mcp__microsoft-learn__*`, `mcp__plugin_supabase_supabase__*`).
- Body là prompt ngôi thứ hai ("Bạn đang chạy CCF `/ccf-...`"). Cấu trúc bằng heading đánh số bước rõ ràng.
- `${CLAUDE_PLUGIN_ROOT}` KHÔNG dùng được trong frontmatter/body command — chỉ trong hook command và mcpServers.

## Agent (`agents/*.md`)
- Frontmatter: `name` (kebab-case, khớp tên file), `description`, `model`, `tools` (comma-separated, least-privilege).
- `description` là field QUYẾT ĐỊNH khi nào Claude gọi agent — phải nêu rõ trigger + phạm vi + giới hạn (vd "Read-only", "KHÔNG sửa code"). Tránh mô tả chung chung.
- Chọn `model` theo chi phí/độ khó: `haiku` cho quét read-only rẻ (`ccf-codebase-analyzer`), `opus` cho implement/review cần suy luận.
- Agent read-only PHẢI khai báo đúng tool read-only (Read/Glob/Grep/Bash-đọc) và nói rõ trong body là không ghi.

## Template (`templates/**/*.tmpl`)
- Placeholder dạng `{{UPPER_SNAKE}}` để `/ccf-init` thay khi instantiate vào dự án đích.
- Comment hướng dẫn dùng HTML comment `<!-- ... -->` để không lọt vào output cuối.
- Template `CLAUDE.md.tmpl` phải tự nó tuân luật < 200 dòng + `@import`, vì nó là khuôn cho spec dự án khác.
- Ba nhánh template: `root/` (luôn dùng), `backend/` + `frontend/` (chỉ khi dự án đích fullstack).

## Quy ước chung
- Ngôn ngữ nội dung: **tiếng Việt** (khớp toàn bộ codebase hiện tại), giữ nguyên tên định danh kỹ thuật.
- Khi thêm/đổi/xóa một command hay agent: cập nhật README bảng lệnh, mọi cross-reference trong prompt khác, và (nếu liên quan) `plugin.json`.
- Mỗi artifact một trách nhiệm (SRP): command điều phối luồng, agent làm một loại việc, template mô tả một loại file.
