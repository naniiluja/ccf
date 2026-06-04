# Task 025 — explore-guide-inject: tiêm hướng dẫn LSP/ripgrep vào agent Explore built-in

- **Vertical slice:** pure lib (`buildExploreGuidance`) → test failing-first → hook mới (`explore-guide-inject.mjs`) → wiring `hooks.json` (`SubagentStart` matcher `"Explore"`). Đây là đường end-to-end mỏng nhất chứng minh Explore nhận được directive.
- **Depends on:** — (none; tập file rời nhau với backlog 017–019/020–021/022–023, chỉ giao ở `CLAUDE.md`/`PLAN.md` narrative + count, xử lý ở 026)
- **Spec refs:** `hooks.md` (I/O contract `emitContext`/`readStdinJson`; SubagentStart chấp nhận `additionalContext`; no-build/no-dep/Windows-clean; best-effort never-block); `coding-conventions.md` (pure helper, JSDoc, KISS/YAGNI); `testing.md` (branchy/content logic → pure helper `node --test`, failing-first); `architecture.md` (deterministic = hook); memory [[ccf-enforce-with-hook-not-prompt]], [[subagent-spawn-tool-named-agent]], [[output-style-not-inherited-by-subagents]]
- **Implemented by:** ccf-implementer (session sạch), then `/ccf:ccf-check` + `/code-review`
- **Test discipline:** OFF (pure lib vẫn `node --test` theo luật repo)
- **Gate (phải GREEN trước khi sang 026):**
  - `node --test plugins/ccf/hooks/lib/*.test.mjs` — toàn xanh (nhóm `explore-guide` mới + 113 baseline)
  - `npx -p typescript tsc --noEmit` — exit 0
  - Smoke stdin: `'{"agent_type":"Explore","cwd":"."}' | node plugins/ccf/hooks/explore-guide-inject.mjs` → JSON `{ hookSpecificOutput: { hookEventName:"SubagentStart", additionalContext:"…LSP…" } }`, exit 0
  - `claude plugin validate plugins/ccf` — accepted (SubagentStart array có 2 object hợp lệ)

## Goal (one sentence)
Mỗi lần main loop spawn agent `Explore` built-in, một hook `SubagentStart` (matcher `"Explore"`) tiêm directive ngắn, trung-lập-ngôn-ngữ, có-điều-kiện-LSP, dạy nó ưu tiên semantic navigation (LSP) + ripgrep/Grep + Glob thay vì đọc nguyên file.

## Root cause / vì sao là hook (grounded)
CCF không sở hữu prompt của `Explore` (artifact của harness) → không sửa trực tiếp được. Đòn bẩy xác định duy nhất: tiêm lúc spawn qua `SubagentStart` + `additionalContext` (giống `agent-rules-inject.mjs`). Grounded `code.claude.com/docs/en/hooks` (SubagentStart fire cho built-in agent; input có `agent_type`; matcher lọc trên `agent_type`; `additionalContext` "added before its first prompt", không block) + `/tools-reference` (tool `LSP` read-only, **inactive tới khi có language server** → directive PHẢI có điều kiện + "no server → fall back, don't retry") + `/sub-agents` (Explore chỉ bị deny Write/Edit → vẫn giữ LSP+Grep).

## Design
**Lib thuần** `plugins/ccf/hooks/lib/explore-guide.mjs`:
```js
/**
 * Build the exploration directive injected into a spawned Explore subagent's context.
 * Language-agnostic + LSP-conditional: prefer semantic nav when a server exists, else fall back.
 * @returns {string}
 */
export function buildExploreGuidance() { /* ráp các dòng dưới, join("\n") */ }
```
Nội dung directive (≤ ~8 dòng non-blank), giữ NGUYÊN câu "no server → just fall back, don't retry":
```
CCF: When exploring this codebase, prefer SEMANTIC navigation over reading whole files.
- If a language server is available for the file type, use the LSP tool: workspaceSymbol to
  find a symbol by name, goToDefinition / goToImplementation to jump, findReferences /
  incomingCalls to trace usage, documentSymbol to outline a file. (No server → the call errors;
  just fall back, don't retry.)
- For text/pattern search use Grep (ripgrep-backed): the `type` filter, -A/-B context, multiline.
- Use Glob for filename patterns. Read whole files only after locating the relevant region.
```
**Hook** `plugins/ccf/hooks/explore-guide-inject.mjs` — I/O thuần: header comment (event/mechanism/role); `const input = await readStdinJson();` → `emitContext("SubagentStart", buildExploreGuidance())`; bọc try/catch → `exit 0`. KHÔNG cần filter `agent_type` nội bộ — matcher `"Explore"` ở `hooks.json` đã là cổng; nếu matcher lỡ over-match thì tiêm "ưu tiên LSP" vào agent khác cũng vô hại.
**hooks.json** — thêm object thứ 2 vào array `SubagentStart`:
```json
{ "matcher": "Explore", "hooks": [{ "type": "command", "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/explore-guide-inject.mjs\"", "timeout": 10 }] }
```
+ mở rộng `description` ở `hooks.json:2` (thêm mệnh đề Explore-guidance). **tsconfig KHÔNG đụng** — glob `plugins/ccf/hooks/**/*.mjs` đã phủ, `*.test.mjs` đã loại.

## Matcher-key evidence (premortem M — phủ [[subagent-spawn-tool-named-agent]])
Trước khi tin `"Explore"`: grep các transcript `.jsonl` session sẵn có tìm dòng `SubagentStart` thật, xác nhận `agent_type`. Nếu tìm thấy → commit làm fixture + thêm assertion `node --test` rằng matcher key == giá trị quan sát. Nếu KHÔNG có dòng thật lúc 025 → ghi rõ trong file này: matcher key **evidence-pending** → 025a BẮT BUỘC chụp trước khi đóng iteration (không được waive bằng acceptance).

> **025 finding — matcher key EVIDENCE-PENDING.** Grep toàn bộ `C:\Users\quang.hoang\.claude\projects\D--ccf\**` (cả `*.jsonl` chính + `subagents/*.jsonl` + tool-results): KHÔNG có dòng hook-input `SubagentStart` thật nào mang `"agent_type": "<value>"` (chỉ có prose/docs nhắc "SubagentStart"). Vì vậy matcher key `"Explore"` ĐANG là giả định dựa trên doc, CHƯA xác nhận trên harness của user. **025a BẮT BUỘC**: chụp 1 dòng `SubagentStart` thật khi main loop spawn agent Explore, xác nhận giá trị `agent_type` (có thể là `Explore`, `general-purpose`, hay tên khác), commit làm fixture, và thêm assertion vào `explore-guide.test.mjs` rằng matcher key == giá trị quan sát. Không được đóng iteration bằng acceptance khi điều này còn pending. (Note đã ghi sẵn trong `explore-guide.test.mjs`.)

## Acceptance criteria (verifiable)
- [ ] `lib/explore-guide.mjs`: `buildExploreGuidance()` export + JSDoc, thuần.
- [ ] `lib/explore-guide.test.mjs` (failing-first): directive non-empty; bounded ≤ ~8 dòng non-blank; chứa các op LSP (`workspaceSymbol`/`goToDefinition`/`findReferences`/`documentSymbol`); chứa `Grep`/ripgrep + `Glob`; chứa NGUYÊN VĂN "don't retry".
- [ ] `explore-guide-inject.mjs`: đọc stdin best-effort, emit `additionalContext`, mọi lỗi → `exit 0`.
- [ ] `hooks.json`: object thứ 2 trong `SubagentStart` (matcher `"Explore"`) + `description` cập nhật.
- [ ] (nếu có dòng thật) fixture `SubagentStart` + assertion matcher key; (nếu không) note evidence-pending.

## Test first (failing-first)
1. `buildExploreGuidance()` trả chuỗi non-empty, ≤ ~8 dòng non-blank.
2. Chứa cả 4 op LSP nêu trên (regex từng tên).
3. Chứa `Grep` + `ripgrep` + `Glob`.
4. Chứa literal "don't retry" (premortem L — không cho Explore retry LSP ở dự án không có server).
5. (điều kiện) matcher key `"Explore"` == `agent_type` trong fixture thật.

## Files to touch
- `plugins/ccf/hooks/lib/explore-guide.mjs`, `plugins/ccf/hooks/lib/explore-guide.test.mjs`
- `plugins/ccf/hooks/explore-guide-inject.mjs`, `plugins/ccf/hooks/hooks.json`
- (docs/count sync → để 026)

## Steps (thin end-to-end slice)
1. Viết test failing-first vào `explore-guide.test.mjs`; `node --test` thấy đỏ đúng chỗ.
2. Thêm `buildExploreGuidance` → xanh.
3. Viết `explore-guide-inject.mjs` + wiring `hooks.json`.
4. `tsc`; smoke stdin `agent_type:"Explore"`; `claude plugin validate`.
5. Grep transcript tìm dòng SubagentStart thật → fixture HOẶC note evidence-pending.
6. Cập nhật `PLAN.md` status 025 → `in-review`. (KHÔNG đóng iteration — chờ 026 + 025a.)

## Notes / best-practice sources
Grounded Context7 `/websites/code_claude` (`/hooks`, `/tools-reference`, `/sub-agents`). Quyết định EXCLUDE ast-grep sau khi research Anthropic/GitHub: stack explore chính thống = Glob+Grep+LSP, "add complexity only when it demonstrably improves outcomes" → ast-grep không cài-sẵn + trùng LSP → bỏ ([[user-delegates-pick-best-practice-not-complex]]). Hook mới, KHÔNG gộp vào `agent-rules-inject` (SRP: target/purpose/filter khác).
