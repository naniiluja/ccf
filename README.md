# CCF — Claude Context First

Một plugin workflow cho [Claude Code](https://code.claude.com) áp đặt cách làm việc **context-first, spec-driven, strictly sequential**:

- **Context-first**: spec sống trong `CLAUDE.md` + `.claude/`, được cập nhật liên tục để mỗi session luôn có context tươi.
- **Grounding**: mọi quyết định thiết kế tham chiếu best practice từ **Context7** và **Microsoft Learn** (2 MCP server đi kèm plugin).
- **Strictly sequential**: làm một task một lần (waterfall), không phát triển song song nhiều feature — để đảm bảo chất lượng.
- **Monorepo**: git init ở thư mục gốc; nếu fullstack thì có `be/` và `fe/` riêng, mỗi cái có spec lồng.

## Cài đặt

### Qua marketplace (khuyến nghị)
```
/plugin marketplace add naniiluja/ccf
/plugin install ccf@ccf
```

### Qua npx
```
npx ccf
```
(chạy `claude plugin marketplace add` + `install` giúp bạn)

### Local (để phát triển)
```
claude plugin marketplace add D:/projects/ccf
claude plugin install ccf@ccf
```

Sau khi cài, mở Claude Code ở thư mục dự án và chạy `/ccf:ccf-init`.

## 6 lệnh

| Lệnh | Tác dụng |
|------|----------|
| `/ccf:ccf-init` | Bootstrap dự án mới (phỏng vấn → sinh CLAUDE.md + .claude + plan) hoặc onboard dự án có sẵn (5 agent phân tích). |
| `/ccf:ccf-plan` | Tạo plan tuần tự cho một feature. **Yêu cầu plan mode** (Shift+Tab). Sau plan, execute từng task bằng agent. |
| `/ccf:ccf-check` | Verify implementation so với spec (conformance, convention, SOLID/OOP, cross-check BE↔FE). |
| `/ccf:ccf-fix` | Debug có kỷ luật: tái hiện → trace log/DB từng bước → root cause → failing test → fix. |
| `/ccf:ccf-updatespec` | Cập nhật spec với bài học trong session (gồm công cụ mới kèm "dùng khi nào"). |
| `/ccf:ccf-compact` | Sinh hint compact tối ưu từ task đang làm để bạn chạy `/compact <hint>` chủ động. |

Luồng điển hình: `ccf-init` → (plan mode) `ccf-plan` → implement → `ccf-check` → `/code-review` → `ccf-updatespec`.

## MCP server đi kèm

Plugin tự bundle 2 MCP server (plugin scope, Claude Code tự start/stop):

- **microsoft-learn** — `https://learn.microsoft.com/api/mcp` (remote HTTP, không cần auth).
- **context7** — `https://mcp.context7.com/mcp` (remote HTTP, chạy ngay không cần key).

> **Context7 rate limit:** plugin chạy Context7 không cần API key (rate limit free). Nếu gặp rate-limit, lấy free key tại [context7.com/dashboard](https://context7.com/dashboard), set env var `CONTEXT7_API_KEY`, rồi khởi động lại Claude Code.

## Cơ chế compact-aware

`/compact <hint>` chủ động tốt hơn để auto-compact tự kích hoạt (lúc context đã "rot" mô hình kém minh mẫn nhất). CCF hỗ trợ:
- `/ccf:ccf-compact` sinh hint tốt từ task đang làm.
- Hook `SessionStart` (matcher `compact`) tự re-load task in-progress từ `.claude/plan/PLAN.md` sau khi compact, khôi phục đúng context công việc.

## Kiến trúc

- **Command** = file markdown prompt điều khiển Claude trong session (không phải script).
- **Hook** = `.mjs` chạy trực tiếp bằng `node` — không build step, không dependency, Windows-clean.
- **Agent** = 6 subagent chuyên biệt (analyzer, researcher, implementer, spec-writer, spec-checker, debugger).

Xem `plugins/ccf/` cho chi tiết. Yêu cầu Node ≥ 18 cho hook.

## License

MIT
