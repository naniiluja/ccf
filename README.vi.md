# CCF — Claude Context First

[English](./README.md) · **Tiếng Việt** · [简体中文](./README.zh-CN.md)

Một plugin workflow cho [Claude Code](https://code.claude.com) áp đặt cách làm việc **context-first, spec-driven, strictly sequential**. CCF biến vòng lặp "vibe coding" lỏng lẻo thành một pipeline có kỷ luật: spec luôn tươi, mọi quyết định đều grounded trong tài liệu thật, và công việc diễn ra từng slice verify được một lúc.

- **Context-first** — spec sống trong `CLAUDE.md` + `.claude/`, được cập nhật liên tục để mỗi session bắt đầu là đã hiểu dự án.
- **Grounding** — mọi quyết định thiết kế tham chiếu best practice từ **Context7** và **Microsoft Learn** (2 MCP server đi kèm plugin), không dựa vào trí nhớ.
- **Strictly sequential** — làm một task một lần (waterfall các vertical slice), không phát triển song song nhiều feature, để tối đa chất lượng.
- **Thích ứng với codebase của bạn** — bootstrap dự án mới dạng monorepo (git init ở thư mục gốc; fullstack tách `be/` + `fe/` với spec lồng) *hoặc* onboard codebase có sẵn, lúc này `/ccf:init` phân tích cấu trúc thật (5 agent read-only) và sinh spec phản ánh đúng nó — không ép buộc layout nào.
- **Code trực tiếp, nhanh** — không phải chờ subagent viết code. Việc implement diễn ra ngay trong main session, với plan và codebase đã sẵn có trong context; subagent của CCF chỉ còn dùng để khám phá, review và tra cứu best practice.

## Vì sao CCF — những vấn đề nó giải quyết

| Nỗi đau trong Claude Code thuần | CCF làm gì với nó |
|---|---|
| Context "rot" qua một session dài; model trôi khỏi rule | Một **hook `SessionStart`** re-inject lời nhắc context-first ở mỗi start/clear/compact, và re-load task in-progress sau compact. |
| Spec âm thầm tụt lại sau code | Hai **hook freshness** so **thời điểm commit git** cuối của spec vs code và *nudge* `/ccf:updatespec` — lúc bắt đầu session và khi bạn dừng. |
| Planning trượt thẳng sang sửa file | Một **hook `UserPromptSubmit`** chặn cứng `/ccf:plan` trừ khi bạn ở plan mode — planning luôn read-only và review được. |
| Quyết định thiết kế dựa trên trí nhớ cũ | **Context7 + Microsoft Learn** MCP đi kèm; prompt CCF trích dẫn tài liệu chính thức trước khi viết. |
| Sai lầm lặp lại qua các session | `/ccf:updatespec` ghi **hai tầng** — rule dự án vào spec, feedback chống lỗi vào **memory** hệ thống (nạp ở trọng số cao hơn). |
| Feature big-bang khó review | Plan là **waterfall các vertical slice**, mỗi slice là một tracer-bullet mỏng (DB→service→UI) với test gate riêng. |
| Test viết qua loa (hoặc bỏ) khi gấp deadline | Một **test discipline opt-in** — khi bật, một ma trận ở mức contract (Equivalence Partitioning + Boundary Value Analysis + decision table) được thiết kế và test được viết failing-first ngay trong lúc implement, và một **Stop-hook gate chặn việc dừng** cho tới khi test thực sự pass. Luồng ship-nhanh thì đơn giản là không opt-in. |

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

Sau khi cài, mở Claude Code ở thư mục dự án và chạy `/ccf:init`.

## 5 lệnh

| Lệnh | Tác dụng |
|------|----------|
| `/ccf:init` | Bootstrap dự án mới (phỏng vấn → sinh CLAUDE.md + .claude + plan) hoặc onboard dự án có sẵn (5 agent phân tích read-only map cấu trúc thật). |
| `/ccf:plan` | Tạo plan tuần tự cho một feature, grounded trong best practice. **Yêu cầu plan mode** (Shift+Tab) — được hook bắt buộc. Sau plan, implement từng task trực tiếp trong session, lần lượt một task. |
| `/ccf:check` | Verify implementation so với spec (conformance, convention, SOLID/OOP, cross-check BE↔FE). Read-only — đây là bước verify bắt buộc duy nhất trước khi một task được đánh dấu `done`. |
| `/ccf:updatespec` | Cập nhật spec **và memory hệ thống** với bài học trong session (gồm công cụ mới kèm "dùng khi nào"). |
| `/ccf:cook` | Chạy toàn bộ backlog todo/in-progress trong một lần, implement từng task trực tiếp trong session (dừng ngay khi gate đỏ), rồi chạy một lượt `/ccf:check` và `/ccf:updatespec` duy nhất. Loại trừ lẫn nhau với `auto-verify.mjs --auto-verify`. |

Luồng điển hình: `/ccf:init` → (plan mode) `/ccf:plan` → implement trực tiếp (từng task, hoặc cả backlog qua `/ccf:cook`) → `/ccf:check` → `/ccf:updatespec`. Khi test discipline bật, ma trận test mức contract được viết ngay trong lúc implement và `/ccf:check` xác nhận chúng pass. `/code-review` vẫn là gợi ý tùy chọn tốt, không còn là bước bắt buộc.

## 4 agent — tất cả đều read-only

Không còn subagent nào viết code: mọi task đều được implement **trực tiếp trong main session**. Spawn một subagent để viết code nghĩa là phải chờ một context riêng khởi động, đọc task, rồi trả kết quả về — chậm hơn hẳn so với tự viết code khi plan và codebase đã sẵn có trong context, nên subagent của CCF chỉ còn dùng để khám phá, review và tra cứu best practice.

Các subagent chuyên biệt **kế thừa tool, MCP server và skill của dự án host** — nên chúng dùng được bất kỳ MCP nào dự án bạn cung cấp (Supabase, Oracle, chrome-devtools, …) và gọi được skill của dự án, không phải bảo trì allowlist riêng cho từng agent. Mọi agent CCF đều là **leaf** — mang `disallowedTools: Write, Edit, NotebookEdit, Agent, Task` nên không ghi file được và không spawn được agent con (mặc định vẫn cho nest-spawn, nhưng giới hạn thay đổi theo bản: 5 ở bản v2.1.172 tới v2.1.216, 1 — coi như tắt hẳn — ở bản v2.1.217 và v2.1.218, rồi trở lại 3 từ bản v2.1.219 trở đi, đây là mặc định hiện hành; đổi được bằng biến môi trường `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` — đặt bằng `1` chỉ tắt spawn LỒNG NHAU, nghĩa là agent con không spawn được agent con của riêng nó nữa; harness vẫn spawn agent ở tầng 1 như bình thường. CCF vẫn chặn spawn lồng nhau một cách xác định bất kể con số mặc định của môi trường). Parallelism **chỉ dành cho research read-only**, và vì không agent nào ghi file nữa nên không còn mối lo riêng về "song song khi ghi file" phải theo dõi.

| Agent | Vai trò | Chế độ |
|---|---|---|
| `ccf-codebase-analyzer` | Phân tích một slice của codebase có sẵn và báo cáo hiện trạng, không đề xuất giải pháp. Được fan-out 5 cái song song bởi `/ccf:init` (slice onboarding, quét cả dự án) và `/ccf:plan` (slice lập kế hoạch, chỉ trong phạm vi thay đổi được yêu cầu). Các lệnh CCF khám phá code qua agent này, không dùng `Explore` gốc. | read-only |
| `ccf-best-practice-researcher` | Lấy best practice có trích dẫn từ Context7 / MS Learn trong context tách biệt. | read-only |
| `ccf-spec-writer` | Soạn nội dung CLAUDE.md / rules từ bản tóm tắt quyết định, dùng cho `/ccf:init` và `/ccf:updatespec`; luồng chính mới là nơi ghi file. | soạn |
| `ccf-spec-checker` | Reviewer context tươi — kiểm implementation so với spec (conformance, convention, SOLID/OOP, drift). | read-only |

## Hook — tầng deterministic

Command và agent là *prompt* (model có thể chọn lờ một prompt đi). **Hook là phần deterministic duy nhất của CCF** — script `.mjs` chạy bằng `node` ở các sự kiện lifecycle, nên chúng kích hoạt mỗi lần bất kể model quyết gì. Chúng **no-build, no-dependency, Windows-clean** (Node ≥ 18, chỉ dùng built-in).

| Hook | Sự kiện | Đảm bảo điều gì |
|---|---|---|
| **plan-mode-guard** | `UserPromptSubmit` | Nếu prompt chứa `/ccf:plan` nhưng session **không ở plan mode**, nó **chặn** (exit 2) và bảo bạn vào plan mode. Mọi prompt khác đi qua nguyên vẹn. Đây là nửa *được cưỡng chế* của "planning là read-only và review trước khi execute". |
| **session-start** | `SessionStart` (`startup\|clear\|compact`) | Inject lời nhắc context-first để model tỉnh dậy đã ở chế độ CCF. Nếu **CCF-managed**, nó thêm *freshness signal* khi code có vẻ mới hơn spec, và sau `compact`/`clear` nó **re-load task in-progress** từ `.claude/plan/PLAN.md` để bạn resume đúng chỗ. |
| **updatespec-nudge** | `Stop` | Thuần **advisory**, không bao giờ chặn. Bốn clause độc lập: **(A)** nếu bạn sửa code trong session mà chưa chạy test, nhắc *verify your work* (chạy test / type-check); **(B)** nếu code đã đổi nhưng spec thì chưa, nudge `/ccf:check` rồi `/ccf:updatespec`; **(C)** nếu bạn đã chạy `git commit` trong session mà `PLAN.md` vẫn còn task chưa `done`, nhắc bạn đánh dấu mỗi task `done` (chỉ sau khi `/ccf:check` của nó pass) hoặc sửa lại status; **(D)** nếu một iteration trong `PLAN.md` đã đóng hết mọi row task, hook in ra đúng câu lệnh `scripts/archive-plan.mjs` để archive nó. Chống loop re-trigger qua `stop_hook_active`. Đường mặc định là đơn kênh (chỉ `systemMessage`). **Opt-in** (mặc định tắt): thêm `--dual-channel-stop` vào lệnh `updatespec-nudge.mjs` trong `hooks.json` để phát cùng lúc `additionalContext` (dành cho model) và `systemMessage` (dành cho người dùng) — **chưa được quan sát** trên payload `Stop` thật của harness, nên vẫn tắt trong `hooks.json` được ship. |
| **auto-verify** | `Stop` | **Opt-in** (mặc định tắt) và là hook Stop DUY NHẤT của CCF có thể **chặn**. Bật bằng cách thêm `--auto-verify` vào lệnh `auto-verify.mjs` trong `hooks.json`. Khi một task đang **in-review**, session này đã **sửa code**, và chưa có review `ccf-spec-checker` nào chạy, nó trả về `decision: "block"` ("ralph loop") kèm reason lái main loop chạy một bước verify duy nhất — `/ccf:check`, rồi `/ccf:updatespec` ngay khi nó sạch. Chống loop qua `stop_hook_active`; best-effort, mọi lỗi đều thoát im lặng. |
| **context-guard** | `UserPromptSubmit` | Khi transcript cho thấy context đã vượt ~40% cửa sổ context của model — chặn ở mức tuyệt đối ~300k token, vì 40% của cửa sổ 1M-native (Opus/Sonnet 4.x) là không thể đạt trước auto-compact — tức vùng "dumb zone", nó hiện cảnh báo chạy **`/compact` chủ động** (kèm sẵn hint pre-fill từ task đang dở). **Mặc định = warn**, không chặn: lời khuyên tới cả bạn (`systemMessage`) lẫn model (`additionalContext`) mỗi lượt. **Bật hard-block** bằng cách thêm `--hard-block` vào lệnh `context-guard.mjs` trong `hooks.json` — khi đó nó **chặn** (exit 2) mọi prompt vượt ngưỡng cho tới khi bạn compact, có escape hatch (mở đầu prompt bằng `/compact`, hoặc chèn `ccf:override`). Best-effort: không đọc được transcript thì im lặng. |
| **explore-guide-inject** | `SubagentStart` (`Explore`) | CCF không sở hữu prompt của subagent `Explore` built-in, nên lúc spawn hook này **inject** (qua `additionalContext`) một directive khám phá ngắn, **không phụ thuộc ngôn ngữ, có điều kiện LSP**: ưu tiên điều hướng ngữ nghĩa (công cụ `LSP` — `workspaceSymbol`/`goToDefinition`/`findReferences`/`documentSymbol`, fall back khi không có language server) cùng `Grep` (ripgrep) và `Glob`, chỉ đọc cả file sau khi đã định vị vùng cần. Best-effort, không bao giờ chặn việc spawn. Đây giờ là hook `SubagentStart` DUY NHẤT — CCF không còn subagent viết code nào để inject coding rule vào nữa. |

**Freshness heuristic (dùng chung, single source of truth ở `hooks/lib/freshness.mjs`):** cả hai hook freshness so **thời điểm commit git** cuối (`git log -1 --format=%ct`) của file *code* với của file *spec* (`.md` trong `.claude/rules` + `CLAUDE.md`) — committer time, nên phản ánh thay đổi nội dung thật và **miễn nhiễm với `mtime` bị xáo trộn** bởi `checkout`/`pull`/`clone`. Khi git không trả lời được (không phải git repo, hay path chưa có commit — vd dự án vừa `/ccf:init`) nó **fallback về duyệt `mtime` giới hạn độ sâu**, hoạt động với *mọi* layout (`src/`, `server/`, `packages/x/src`, kiểu plugin `plugins/x/hooks`, hay code ở root). Đây là nudge nhẹ, không bao giờ là kết luận chắc chắn — phán xét ở mức nội dung "spec còn chính xác không?" được để cho `/ccf:updatespec`.

**Vì sao hook được auto-load, không cần khai báo:** giống command/agent/MCP, hook tự load từ vị trí chuẩn `hooks/hooks.json` — Claude Code hiện tại (v2.1.x) tự discover. **Đừng** thêm field `"hooks"` vào `plugin.json` trỏ về đúng path chuẩn: nó nạp file hai lần và lỗi `Duplicate hooks file detected`. Field `manifest.hooks` chỉ dành cho các file hook *bổ sung* ở path không chuẩn.

## MCP server đi kèm

Plugin tự bundle 2 MCP server (plugin scope, Claude Code tự start/stop):

- **microsoft-learn** — `https://learn.microsoft.com/api/mcp` (remote HTTP, không cần auth).
- **context7** — `https://mcp.context7.com/mcp` (remote HTTP, chạy ngay không cần key).

> **Context7 rate limit:** plugin chạy Context7 không cần API key (rate limit free). Nếu gặp rate-limit, lấy free key tại [context7.com/dashboard](https://context7.com/dashboard), set env var `CONTEXT7_API_KEY`, rồi khởi động lại Claude Code.

## Spec vs Memory (hai tầng context)

`/ccf:updatespec` ghi bài học vào **hai nơi** với mục đích khác nhau:

- **Spec** (`CLAUDE.md` + `.claude/rules/`) — nạp như *user message*, trọng số thấp hơn. Giữ **rule dự án**: convention, architecture, tech-stack, tooling.
- **Memory** (`~/.claude/projects/<path>/memory/`) — nạp vào *system prompt*, **không bị giảm trọng số** nên Claude tuân mạnh hơn. Giữ **feedback chống lỗi** + **user preference** xuyên session → giúp Claude bớt lặp sai lầm.
- **`MEMORY.md` là index thuần** — mỗi session chỉ nạp **200 dòng đầu hoặc 25KB**, nên phải giữ gọn; tầng mạnh nhất là **`feedback`** (luôn kèm `Why`).

Nguyên tắc: **không trùng lặp**. Rule trong CLAUDE.md hay bị quên → viết một `feedback` memory để *gia cố* (kèm "vì sao"), thay vì chép lại nội dung.

## Cơ chế compact-aware

`/compact <hint>` chủ động tốt hơn để auto-compact tự kích hoạt (lúc context đã "rot" mô hình kém minh mẫn nhất). Sau khi bạn compact, hook `session-start` của CCF (matcher `compact`) tự re-load task in-progress từ `.claude/plan/PLAN.md`, khôi phục đúng context công việc để bạn không phải dán lại.

## Plan = waterfall các vertical slice

`/ccf:init` và `/ccf:plan` sinh một plan trong `.claude/plan/` (một index `PLAN.md` + các file `task-NNN-*.md`). Mỗi task là một **vertical slice mỏng** — tracer-bullet xuyên qua các tầng nó chạm tới (DB + service + UI), sắp xếp mỏng → giàu dần, mỗi cái theo *spec → failing test → implement*. Mỗi task có đúng **một predecessor** và nêu tên **test gate** phải xanh trước khi slice kế bắt đầu. Đây là thứ khiến "strictly sequential" trở nên cụ thể và review được.

`PLAN.md` chỉ chứa iteration **đang chạy**. Khi mọi task của một iteration đã `done`, nó được chuyển sang `ARCHIVE.md` (các file task sang `.claude/plan/archive/`). Quy tắc này cắt về hai phía, và đó là cố ý: một row đã đóng còn nằm trong `PLAN.md` sẽ bị hook session-start và hook Stop đếm là việc còn sống, còn *xoá* lịch sử thì lại làm mất một ghi chép thật về việc gì đã ship và vì sao. Nên luật là archive, tuyệt đối không xoá.

Việc archive được **phát hiện tự động, nhưng thi hành có chủ ý**. Hook Stop nhận ra iteration đã đóng hoàn toàn rồi in ra đúng câu lệnh; `node "<plugin-root>/scripts/archive-plan.mjs"` là bản xem trước (không ghi gì, và nêu tên những row còn giữ iteration mở), thêm `--apply` mới thực hiện — ghi lại cả hai file và `git mv` các file task, có stage nhưng không commit. Phần ghi file cố ý không tự động: hook chạy mà không có ai trong vòng lặp, nên một lần phát hiện sai ở đó sẽ âm thầm viết lại plan và lịch sử của bạn.

## Kiến trúc

- **Command** = 5 file markdown prompt điều khiển Claude trong session (không phải script): init, plan, check, updatespec, cook.
- **Agent** = 4 subagent chuyên biệt, TẤT CẢ đều read-only (analyzer, researcher, spec-writer, spec-checker). Không còn agent nào ghi file — implement luôn diễn ra trực tiếp trong main session.
- **Skill** = 1 skill nội bộ (`grill-me`) — engine phỏng vấn dùng chung mà các command gọi qua Skill tool; ẩn khỏi menu `/` (`user-invocable: false`).
- **Hook** = 6 `.mjs` chạy trực tiếp bằng `node` — không build step, không dependency, Windows-clean; các helper dùng chung (freshness, đọc plan, context-usage, review-trace, git-trace, verify-trace, verify-chain, explore-guide, archive) nằm ở `hooks/lib/`.
- **Script** = 1 CLI do người chạy (`scripts/archive-plan.mjs`) — cùng luật no-build/no-dependency như hook, nhưng không có gì gọi nó tự động. Đây là chỗ dành cho hành động **ghi vào file của bạn**, để phạm vi ảnh hưởng luôn bị giới hạn bởi việc bạn chủ động chạy nó.
- **Template** = file placeholder `{{...}}` (`root/` luôn dùng, `backend/` + `frontend/` khi fullstack) mà `/ccf:init` instantiate.

Xem `plugins/ccf/` cho chi tiết. Yêu cầu Node ≥ 18 cho hook.

## License

MIT

## Lời cảm ơn

Dự án này được công bố lần đầu tại cộng đồng [LINUX DO](https://linux.do/) — cảm ơn các thành viên cộng đồng đã ủng hộ và góp ý.
