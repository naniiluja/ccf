# Task 034 — Hook `SubagentStop` OPT-IN ép `ccf-implementer` chạy test trước khi kết thúc

- **Vertical slice:** 1 hook mới + pure lib + test + wiring + ghim Return-format `ccf-implementer` + doc/count-sync (gộp theo right-size).
- **Depends on:** 033.
- **Spec refs:** `.claude/rules/hooks.md` (hook law + I/O contract), `.claude/rules/architecture.md`, `agents/ccf-implementer.md`, `hooks/lib/io.mjs`, `hooks/auto-verify.mjs`/`verify-chain.mjs` (pattern opt-in); plan Phần 3.
- **Implemented by:** `ccf-implementer` (alias `sonnet`). MCP: Context7 nếu cần tra `SubagentStop` schema.
- **Gate (must be GREEN before task 034a):** `node --test` (nhóm `implementer-verify` + baseline TOÀN BỘ pass); `npx -p typescript tsc --noEmit` exit 0; stdin-smoke ≥4 ca; `claude plugin validate plugins/ccf` (no "Duplicate hooks"); grep hai-lớp count (numeral + table-row) như dưới.

## Goal (one sentence)
Thêm hook `SubagentStop` OPT-IN (mặc-định-TẮT) chặn `ccf-implementer` kết thúc khi `last_assistant_message` CHƯA có bằng chứng chạy test/tsc — thiết kế phòng thủ vì loop-guard + `transcript_path` của SubagentStop CHƯA được docs xác nhận.

## Acceptance criteria (verifiable)
- [ ] `plugins/ccf/hooks/implementer-verify-gate.mjs` (mới): SubagentStop hook, I/O-only, best-effort (any error → exit 0), opt-in qua arg `--enforce-tests` (vắng → exit 0 no-op).
- [ ] `plugins/ccf/hooks/lib/implementer-verify.mjs` (mới, pure):
  - `isImplementer(agentType)` → nhận `ccf-implementer` (harness-dependent → so khớp defensive).
  - `implementerReportedTests(text)` → true nếu có prefix `TEST-RESULT:` + kết quả HOẶC khai báo `TEST-RESULT: n/a (no test surface)` (prose-only hợp lệ).
  - `shouldBlockImplementerStop({enabled, agentType, lastMessage})` = `enabled && isImplementer(agentType) && !implementerReportedTests(lastMessage)`. Coerce input rác → false, không throw.
- [ ] `plugins/ccf/hooks/lib/implementer-verify.test.mjs`: EP — off→false; non-implementer→false; `TEST-RESULT:` có→false; `TEST-RESULT: n/a`→false; thiếu evidence→true; rác→false. + 1 test fixture-THẬT placeholder (điền sau 034a).
- [ ] `plugins/ccf/hooks/lib/io.mjs`: thêm `blockSubagentStop(reason)` (JSDoc) phát `{decision:"block",reason}` cho event SubagentStop (KHÔNG tái dùng `blockStop` mù).
- [ ] `plugins/ccf/agents/ccf-implementer.md`: ghim Return-format — DÒNG CUỐI luôn `TEST-RESULT: <command> → <pass/fail>` HOẶC `TEST-RESULT: n/a (no test surface)` cho task prose-only.
- [ ] `plugins/ccf/hooks/hooks.json`: event `SubagentStop` MỚI = mảng **1 hook** matcher `ccf-implementer` (⚠️ KHÔNG nhầm với `SubagentStart` 2 hook); cập nhật `description`.
- [ ] `.claude/rules/hooks.md`: entry "Events" mới cho SubagentStop + cập nhật bullet I/O-contract (SubagentStop hỗ trợ `decision:block`; `emitContext` không phủ SubagentStop).
- [ ] Count-sync 8→9: numeral `CLAUDE.md:17` + `plugins/ccf/README.md`; **THÊM row** `implementer-verify-gate` vào bảng hook 3 root README; KHÔNG đổi chuỗi `6/6/8/1` lịch sử ở `CLAUDE.md` "Current plan". BỎ `AGENTS.md` (không tồn tại) + `architecture.md` (không có numeral hook) khỏi count-surface.

## Test first (write before implementing)
Viết `implementer-verify.test.mjs` TRƯỚC — chạy đỏ (module chưa tồn tại) → rồi implement pure lib cho xanh. Mutation-check: đảo `shouldBlockImplementerStop` → test phải đỏ.

## Files to touch
- `plugins/ccf/hooks/implementer-verify-gate.mjs` (mới)
- `plugins/ccf/hooks/lib/implementer-verify.mjs` (mới) + `.test.mjs` (mới)
- `plugins/ccf/hooks/lib/io.mjs` — `blockSubagentStop`
- `plugins/ccf/agents/ccf-implementer.md` — Return-format pin
- `plugins/ccf/hooks/hooks.json` — SubagentStop array + description
- `.claude/rules/hooks.md` — Events entry + I/O-contract bullet
- `CLAUDE.md:17`, `plugins/ccf/README.md`, `README.md`/`.vi`/`.zh-CN` (bảng hook +row) — count-sync

## Steps (thin end-to-end slice)
1. Failing test cho pure lib.
2. Implement `implementer-verify.mjs` (pure) + `implementer-verify-gate.mjs` (I/O) + `io.mjs#blockSubagentStop`.
3. Ghim Return-format `ccf-implementer.md`. Wire hooks.json SubagentStop.
4. Count-sync (numeral + table-row). Doc `hooks.md`.
5. `node --test` + `tsc` + stdin-smoke ≥4 + `validate` + grep hai-lớp → GREEN → status `in-review`.

## Notes / best-practice sources
- [hooks.md docs](https://code.claude.com/docs/en/hooks): SubagentStop matcher trên `agent_type`, `decision:block` giữ subagent chạy, scope child-only. ⚠️ `stop_hook_active` + `transcript_path` CHƯA document cho SubagentStop → chỉ dựa `last_assistant_message` + opt-in + 034a observe.
- [[ccf-enforce-with-hook-not-prompt]], [[ccf-plugin-runs-from-cache-not-repo]], bài học `isFailureText` (005–009).
