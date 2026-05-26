# CCF — Claude Context First (plugin source)

> Quản lý bởi **CCF**. Dự án này CHÍNH LÀ source code của plugin CCF — không phải app có DB/API/frontend.
> **STRICTLY SEQUENTIAL**: một thay đổi một lần, không phát triển song song nhiều thứ.
> Ground mọi quyết định về schema/contract của Claude Code bằng tài liệu chính thức (qua Context7) trước khi viết.
> Giữ spec này luôn tươi bằng `/ccf:ccf-updatespec`.

## Hệ thống này là gì
CCF là một **plugin Claude Code** áp đặt workflow context-first, spec-driven, strictly sequential. Nó KHÔNG có runtime ứng dụng (không server, DB, API, UI). Toàn bộ "sản phẩm" là các artifact mà Claude Code nạp: command (prompt markdown), agent/subagent (markdown), hook (script `.mjs` chạy bằng `node`), template để `/ccf-init` instantiate, cùng manifest phân phối. Người dùng cài qua marketplace rồi chạy `/ccf:ccf-*`.

## Bố cục repo
- **git init ở gốc** (`D:/projects/ccf`). Gốc chứa `CLAUDE.md`, `.claude/`, `package.json`, `tsconfig.json`, `bin/`, `README.md`, `LICENSE`, `.claude-plugin/marketplace.json`.
- `plugins/ccf/` — bản thân plugin. `.claude-plugin/plugin.json` là manifest (CHỈ manifest ở trong `.claude-plugin/`); các component directory nằm ở **root của plugin**:
  - `commands/*.md` — 6 slash command (`ccf-init`, `ccf-plan`, `ccf-check`, `ccf-fix`, `ccf-updatespec`, `ccf-compact`).
  - `agents/*.md` — 6 subagent (`ccf-codebase-analyzer`, `ccf-best-practice-researcher`, `ccf-implementer`, `ccf-spec-writer`, `ccf-spec-checker`, `ccf-debugger`).
  - `hooks/*.mjs` + `hooks/hooks.json` + `hooks/lib/io.mjs` — 3 hook (plan-mode-guard, session-start, updatespec-nudge) dùng chung `lib/io.mjs`.
  - `templates/{root,backend,frontend}/**` — file `*.tmpl` chứa placeholder `{{...}}` để `/ccf-init` instantiate.
  - `.mcp.json` — bundle 2 remote MCP server (microsoft-learn, context7).
- `bin/ccf-bootstrap.mjs` — npx entry, chỉ shell-out tới `claude plugin` CLI, không tự ghi file.

## Bất biến cốt lõi (đọc trước khi sửa)
- Hook là **no-build, no-dependency, Windows-clean** `.mjs` chạy thẳng bằng `node` (Node ≥ 18). KHÔNG thêm dependency, KHÔNG thêm build step. Xem `@.claude/rules/hooks.md`.
- Component (command/agent/template) là **prompt markdown**, không phải code thực thi. Sửa nội dung = sửa hành vi của Claude. Xem `@.claude/rules/components.md`.
- `${CLAUDE_PLUGIN_ROOT}` CHỈ expand được trong `hooks[].command` và `mcpServers` — KHÔNG dùng trong frontmatter markdown.
- Mọi `CLAUDE.md` (kể cả file CCF sinh ra cho dự án khác) phải < 200 dòng, đẩy chi tiết vào `.claude/rules/*` qua `@import` (max depth 5).

## Rules (import — giữ file này < 200 dòng)
@.claude/rules/architecture.md
@.claude/rules/components.md
@.claude/rules/hooks.md
@.claude/rules/coding-conventions.md
@.claude/rules/testing.md
@.claude/rules/tooling.md
@.claude/rules/git-workflow.md

## Kế hoạch hiện tại
Chưa có `.claude/plan/`. Khi cần chi tiết hóa một thay đổi (thêm command, sửa hook, đồng bộ tài liệu…), vào plan mode và chạy `/ccf:ccf-plan`. Thực thi **một task một lần**, đúng thứ tự.
