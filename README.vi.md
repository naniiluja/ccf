# CCF — Claude Context First

[English](./README.md) · **Tiếng Việt** · [简体中文](./README.zh-CN.md)

Một plugin workflow cho [Claude Code](https://code.claude.com) áp đặt cách làm việc **context-first, spec-driven, strictly sequential**. CCF biến vòng lặp "vibe coding" lỏng lẻo thành một pipeline có kỷ luật: spec luôn tươi, mọi quyết định đều grounded trong tài liệu thật, và công việc diễn ra từng slice verify được một lúc.

- **Context-first** — spec sống trong `CLAUDE.md` + `.claude/`, được cập nhật liên tục để mỗi session bắt đầu là đã hiểu dự án.
- **Grounding** — mọi quyết định thiết kế tham chiếu best practice từ **Context7** và **Microsoft Learn** (2 MCP server đi kèm plugin), không dựa vào trí nhớ.
- **Strictly sequential** — làm một task một lần (waterfall các vertical slice), không phát triển song song nhiều feature, để tối đa chất lượng.
- **Thích ứng với codebase của bạn** — bootstrap dự án mới dạng monorepo (git init ở thư mục gốc; fullstack tách `be/` + `fe/` với spec lồng) *hoặc* onboard codebase có sẵn, lúc này `/ccf:ccf-init` phân tích cấu trúc thật (5 agent read-only) và sinh spec phản ánh đúng nó — không ép buộc layout nào.

## Vì sao CCF — những vấn đề nó giải quyết

| Nỗi đau trong Claude Code thuần | CCF làm gì với nó |
|---|---|
| Context "rot" qua một session dài; model trôi khỏi rule | Một **hook `SessionStart`** re-inject lời nhắc context-first ở mỗi start/clear/compact, và re-load task in-progress sau compact. |
| Spec âm thầm tụt lại sau code | Hai **hook freshness** so mtime spec vs code và *nudge* `/ccf:ccf-updatespec` — lúc bắt đầu session và khi bạn dừng. |
| Planning trượt thẳng sang sửa file | Một **hook `UserPromptSubmit`** chặn cứng `/ccf:ccf-plan` trừ khi bạn ở plan mode — planning luôn read-only và review được. |
| Quyết định thiết kế dựa trên trí nhớ cũ | **Context7 + Microsoft Learn** MCP đi kèm; prompt CCF trích dẫn tài liệu chính thức trước khi viết. |
| Sai lầm lặp lại qua các session | `/ccf:ccf-updatespec` ghi **hai tầng** — rule dự án vào spec, feedback chống lỗi vào **memory** hệ thống (nạp ở trọng số cao hơn). |
| Feature big-bang khó review | Plan là **waterfall các vertical slice**, mỗi slice là một tracer-bullet mỏng (DB→service→UI) với test gate riêng. |

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
| `/ccf:ccf-init` | Bootstrap dự án mới (phỏng vấn → sinh CLAUDE.md + .claude + plan) hoặc onboard dự án có sẵn (5 agent phân tích read-only map cấu trúc thật). |
| `/ccf:ccf-plan` | Tạo plan tuần tự cho một feature, grounded trong best practice. **Yêu cầu plan mode** (Shift+Tab) — được hook bắt buộc. Sau plan, execute từng task bằng agent. |
| `/ccf:ccf-check` | Verify implementation so với spec (conformance, convention, SOLID/OOP, cross-check BE↔FE). Read-only. |
| `/ccf:ccf-fix` | Debug có kỷ luật: tái hiện → trace log/DB từng bước → root cause → failing test → fix tối thiểu. Không đoán mò. |
| `/ccf:ccf-updatespec` | Cập nhật spec **và memory hệ thống** với bài học trong session (gồm công cụ mới kèm "dùng khi nào"). |

Luồng điển hình: `ccf-init` → (plan mode) `ccf-plan` → implement → `ccf-check` → `/code-review` → `ccf-updatespec`.

## 6 agent

Các subagent chuyên biệt, mỗi cái có tool least-privilege. Parallelism **chỉ dành cho research read-only** — agent ghi file không bao giờ chạy song song trên cùng một feature.

| Agent | Vai trò | Chế độ |
|---|---|---|
| `ccf-codebase-analyzer` | Phân tích một slice của codebase có sẵn; `/ccf-init` fan-out 5 cái song song. | read-only |
| `ccf-best-practice-researcher` | Lấy best practice có trích dẫn từ Context7 / MS Learn trong context tách biệt. | read-only |
| `ccf-implementer` | Implement **đúng một** task plan: failing test trước, rồi code để đạt acceptance criteria. | ghi |
| `ccf-spec-writer` | Soạn nội dung CLAUDE.md / rules từ bản tóm tắt quyết định. | soạn |
| `ccf-spec-checker` | Reviewer context tươi — kiểm implementation hoặc phản biện một plan. | read-only |
| `ccf-debugger` | Điều tra một giả thuyết root-cause, lần theo correlation ID, verify với DB. | read-only |

## Hook — tầng deterministic

Command và agent là *prompt* (model có thể chọn lờ một prompt đi). **Hook là phần deterministic duy nhất của CCF** — script `.mjs` chạy bằng `node` ở các sự kiện lifecycle, nên chúng kích hoạt mỗi lần bất kể model quyết gì. Chúng **no-build, no-dependency, Windows-clean** (Node ≥ 18, chỉ dùng built-in).

| Hook | Sự kiện | Đảm bảo điều gì |
|---|---|---|
| **plan-mode-guard** | `UserPromptSubmit` | Nếu prompt chứa `/ccf:ccf-plan` nhưng session **không ở plan mode**, nó **chặn** (exit 2) và bảo bạn vào plan mode. Mọi prompt khác đi qua nguyên vẹn. Đây là nửa *được cưỡng chế* của "planning là read-only và review trước khi execute". |
| **session-start** | `SessionStart` (`startup\|clear\|compact`) | Inject lời nhắc context-first để model tỉnh dậy đã ở chế độ CCF. Nếu **CCF-managed**, nó thêm *freshness signal* khi code có vẻ mới hơn spec, và sau `compact`/`clear` nó **re-load task in-progress** từ `.claude/plan/PLAN.md` để bạn resume đúng chỗ. |
| **updatespec-nudge** | `Stop` | Thuần **advisory**, không bao giờ chặn. Khi bạn dừng và code đã đổi nhưng spec thì chưa, nó nudge `/ccf:ccf-check` rồi `/ccf:ccf-updatespec`. Chống loop re-trigger qua `stop_hook_active`. |
| **context-nudge** | `PostToolUse` | Thuần **advisory**, không bao giờ chặn. Đọc transcript của session để ước lượng mức dùng context; khi vượt ~40% cửa sổ context của model (vùng "dumb zone"), nó nudge bạn chạy **`/compact` chủ động** — kèm sẵn một hint pre-fill từ task đang dở — thay vì đợi auto-compact (vốn kích hoạt lúc model kém sắc bén nhất). Best-effort: không đọc được transcript thì im lặng. |

**Freshness heuristic (dùng chung, single source of truth ở `hooks/lib/freshness.mjs`):** cả hai hook freshness so `mtime` mới nhất của file *code* với `mtime` mới nhất của file *spec* (`.md` trong `.claude/rules`). Nó **đi qua cây thư mục dự án có giới hạn độ sâu** — nên hoạt động với *mọi* layout (`src/`, `server/`, `packages/x/src`, kiểu plugin `plugins/x/hooks`, hay code ở root), không phải một danh sách tên thư mục cố định. Đây là nudge nhẹ, không bao giờ là kết luận chắc chắn — phán xét ở mức nội dung "spec còn chính xác không?" được để cho `/ccf:ccf-updatespec`.

**Vì sao hook được auto-load, không cần khai báo:** giống command/agent/MCP, hook tự load từ vị trí chuẩn `hooks/hooks.json` — Claude Code hiện tại (v2.1.x) tự discover. **Đừng** thêm field `"hooks"` vào `plugin.json` trỏ về đúng path chuẩn: nó nạp file hai lần và lỗi `Duplicate hooks file detected`. Field `manifest.hooks` chỉ dành cho các file hook *bổ sung* ở path không chuẩn.

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

`/compact <hint>` chủ động tốt hơn để auto-compact tự kích hoạt (lúc context đã "rot" mô hình kém minh mẫn nhất). Sau khi bạn compact, hook `session-start` của CCF (matcher `compact`) tự re-load task in-progress từ `.claude/plan/PLAN.md`, khôi phục đúng context công việc để bạn không phải dán lại.

## Plan = waterfall các vertical slice

`/ccf:ccf-init` và `/ccf:ccf-plan` sinh một plan trong `.claude/plan/` (một index `PLAN.md` + các file `task-NNN-*.md`). Mỗi task là một **vertical slice mỏng** — tracer-bullet xuyên qua các tầng nó chạm tới (DB + service + UI), sắp xếp mỏng → giàu dần, mỗi cái theo *spec → failing test → implement*. Mỗi task có đúng **một predecessor** và nêu tên **test gate** phải xanh trước khi slice kế bắt đầu. Đây là thứ khiến "strictly sequential" trở nên cụ thể và review được.

## Kiến trúc

- **Command** = file markdown prompt điều khiển Claude trong session (không phải script).
- **Agent** = 6 subagent chuyên biệt (analyzer, researcher, implementer, spec-writer, spec-checker, debugger).
- **Skill** = 1 skill nội bộ (`grill-me`) — engine phỏng vấn dùng chung mà các command gọi qua Skill tool; ẩn khỏi menu `/` (`user-invocable: false`).
- **Hook** = 4 `.mjs` chạy trực tiếp bằng `node` — không build step, không dependency, Windows-clean; các helper dùng chung (freshness, đọc plan, context-usage) nằm ở `hooks/lib/`.
- **Template** = file placeholder `{{...}}` (`root/` luôn dùng, `backend/` + `frontend/` khi fullstack) mà `/ccf:ccf-init` instantiate.

Xem `plugins/ccf/` cho chi tiết. Yêu cầu Node ≥ 18 cho hook.

## License

MIT

## Lời cảm ơn

Dự án này được công bố lần đầu tại cộng đồng [LINUX DO](https://linux.do/) — cảm ơn các thành viên cộng đồng đã ủng hộ và góp ý.
