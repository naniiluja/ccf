# CCF — Claude Context First

[English](./README.md) · **Tiếng Việt** · [简体中文](./README.zh-CN.md)

Một plugin workflow cho [Claude Code](https://code.claude.com) áp đặt cách làm việc **context-first, spec-driven, strictly sequential**:

- **Context-first**: spec sống trong `CLAUDE.md` + `.claude/`, được cập nhật liên tục để mỗi session luôn có context tươi.
- **Grounding**: mọi quyết định thiết kế tham chiếu best practice từ **Context7** và **Microsoft Learn** (2 MCP server đi kèm plugin).
- **Strictly sequential**: làm một task một lần (waterfall), không phát triển song song nhiều feature — để đảm bảo chất lượng.
- **Thích ứng với codebase của bạn**: bootstrap dự án mới dạng monorepo (git init ở thư mục gốc; fullstack tách `be/` + `fe/`, mỗi cái có spec lồng) — *hoặc* onboard codebase có sẵn, lúc này `/ccf:ccf-init` phân tích cấu trúc thật (5 agent read-only) và sinh spec phản ánh đúng nó, không ép buộc layout nào.

## Cài đặt

### Qua marketplace (khuyến nghị)
```
/plugin marketplace add naniiluja/ccf
/plugin install ccf@ccf
```

### Qua npx
```
npx @naniiluja/ccf
```
(chạy `claude plugin marketplace add` + `install` giúp bạn)

### Local (để phát triển)
```
claude plugin marketplace add D:/projects/ccf
claude plugin install ccf@ccf
```

Sau khi cài, mở Claude Code ở thư mục dự án và chạy `/ccf:ccf-init`.

## 5 lệnh

| Lệnh | Tác dụng |
|------|----------|
| `/ccf:ccf-init` | Bootstrap dự án mới (phỏng vấn → sinh CLAUDE.md + .claude + plan) hoặc onboard dự án có sẵn (5 agent phân tích). |
| `/ccf:ccf-plan` | Tạo plan tuần tự cho một feature. **Yêu cầu plan mode** (Shift+Tab). Sau plan, execute từng task bằng agent. |
| `/ccf:ccf-check` | Verify implementation so với spec (conformance, convention, SOLID/OOP, cross-check BE↔FE). |
| `/ccf:ccf-fix` | Debug có kỷ luật: tái hiện → trace log/DB từng bước → root cause → failing test → fix. |
| `/ccf:ccf-updatespec` | Cập nhật spec **và memory hệ thống** với bài học trong session (gồm công cụ mới kèm "dùng khi nào"). |

Luồng điển hình: `ccf-init` → (plan mode) `ccf-plan` → implement → `ccf-check` → `/code-review` → `ccf-updatespec`.

## MCP server đi kèm

Plugin tự bundle 2 MCP server (plugin scope, Claude Code tự start/stop):

- **microsoft-learn** — `https://learn.microsoft.com/api/mcp` (remote HTTP, không cần auth).
- **context7** — `https://mcp.context7.com/mcp` (remote HTTP, chạy ngay không cần key).

> **Context7 rate limit:** plugin chạy Context7 không cần API key (rate limit free). Nếu gặp rate-limit, lấy free key tại [context7.com/dashboard](https://context7.com/dashboard), set env var `CONTEXT7_API_KEY`, rồi khởi động lại Claude Code.

## Spec vs Memory (hai tầng context)

`/ccf:ccf-updatespec` ghi bài học vào **hai nơi** với mục đích khác nhau:

- **Spec** (`CLAUDE.md` + `.claude/rules/`) — nạp như *user message*, trọng số thấp hơn. Giữ **rule dự án**: convention, architecture, tech-stack, tooling.
- **Memory** (`~/.claude/projects/<path>/memory/`) — nạp vào *system prompt*, **không bị giảm trọng số** nên Claude tuân mạnh hơn. Giữ **feedback chống lỗi** + **user preference** xuyên session → giúp Claude bớt lặp sai lầm.

Nguyên tắc: **không trùng lặp**. Rule trong CLAUDE.md hay bị quên → viết một `feedback` memory để *gia cố* (kèm "vì sao"), thay vì chép lại nội dung.

## Cơ chế compact-aware

`/compact <hint>` chủ động tốt hơn để auto-compact tự kích hoạt (lúc context đã "rot" mô hình kém minh mẫn nhất). Sau khi bạn compact, hook `SessionStart` của CCF (matcher `compact`) tự re-load task in-progress từ `.claude/plan/PLAN.md`, khôi phục đúng context công việc để bạn không phải dán lại.

## Kiến trúc

- **Command** = file markdown prompt điều khiển Claude trong session (không phải script).
- **Hook** = `.mjs` chạy trực tiếp bằng `node` — không build step, không dependency, Windows-clean.
- **Agent** = 6 subagent chuyên biệt (analyzer, researcher, implementer, spec-writer, spec-checker, debugger).

Xem `plugins/ccf/` cho chi tiết. Yêu cầu Node ≥ 18 cho hook.

## License

MIT

## Lời cảm ơn

Dự án này được công bố lần đầu tại cộng đồng [LINUX DO](https://linux.do/) — cảm ơn các thành viên cộng đồng đã ủng hộ và góp ý.
