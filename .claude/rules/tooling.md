---
description: Công cụ và MCP dùng trong/để phát triển plugin CCF — kèm "dùng khi nào".
---

# Tooling

## MCP server bundle theo plugin (`plugins/ccf/.mcp.json`)
Hai remote HTTP server, Claude Code tự start/stop theo plugin scope:
- **context7** (`https://mcp.context7.com/mcp`) — **dùng khi**: cần tra schema/contract/cú pháp của Claude Code, thư viện, framework, CLI. Quy trình: `resolve-library-id` → `query-docs`. Chạy không cần API key (rate-limit free); nếu bị rate-limit, set env `CONTEXT7_API_KEY` (lấy free ở context7.com/dashboard) rồi restart Claude Code.
- **microsoft-learn** (`https://learn.microsoft.com/api/mcp`) — **dùng khi**: cần hướng dẫn platform Microsoft/Azure/.NET. Không cần auth. Tools: `microsoft_docs_search` (breadth) → `microsoft_code_sample_search` (ví dụ) → `microsoft_docs_fetch` (depth).

> Grounding là luật CCF: trước khi viết spec/quyết định về schema Claude Code hay thư viện, tra tài liệu chính thức rồi TRÍCH DẪN, không dựa trí nhớ.

## Subagent grounding
- `ccf-best-practice-researcher` — **dùng khi**: muốn fan-out việc tra cứu best-practice ra context riêng để không làm ngập main conversation. Nó gọi Context7/MS Learn và trả khuyến nghị có trích dẫn.

## Công cụ phát triển plugin
- **Node ≥ 18** — chạy hook và `bin/ccf-bootstrap.mjs`.
- **`tsc`** — type-check JS qua `tsconfig.json`. **Dùng khi**: vừa sửa bất kỳ `.mjs` nào. Chạy `npm install` (một lần) rồi `npx tsc --noEmit`. Cần `@types/node` (đã ở `devDependencies`) vì `tsconfig` đặt `"types": ["node"]` — đây là devDependency type-check, không phải runtime dep.
- **`claude plugin` CLI** — `marketplace add` / `install`. **Dùng khi**: cài thử local hoặc trong `bin/ccf-bootstrap.mjs`.

## Tự kiểm CCF (lệnh nội bộ)
- `/ccf:ccf-check` — verify implementation so với spec này (conformance, convention, SOLID, cross-check).
- `/ccf:ccf-updatespec` — refresh spec sau session; **ghi cả công cụ mới kèm "dùng khi nào"** vào chính file này.
- `/ccf:ccf-compact` — sinh hint cho `/compact` chủ động trước khi context rot.

## Quy ước thêm tool mới
Khi tích hợp công cụ/MCP mới, thêm mục ở đây với định dạng "**tên** — dùng khi nào — cách gọi", và cập nhật `allowed-tools`/`tools` của command/agent liên quan.
