# Task 035 — Đổi tên 6 lệnh: bỏ tiền tố `ccf-` (gọi qua namespace `/ccf:<name>`)

- **Vertical slice:** rename 6 command files + đồng bộ MỌI cross-ref + regex/reason hook + test + doc + version bump. Một slice cố kết (structural rename).
- **Depends on:** — (task độc lập, iteration mới)
- **Implemented by:** `ccf-implementer` (alias `sonnet`).
- **Gate:** `node --test plugins/ccf/hooks/lib/*.test.mjs` toàn bộ pass; `npx -p typescript tsc --noEmit` exit 0; `claude plugin validate plugins/ccf` pass; grep-consistency (không còn ref lệnh cũ dạng sống; 6 file đã rename); smoke hook plan-mode-guard + plan-review-gate với tên MỚI.

## Goal (one sentence)
Đổi 6 lệnh `ccf-init|ccf-plan|ccf-check|ccf-fix|ccf-updatespec|ccf-cook` → `init|plan|check|fix|updatespec|cook` (gọi `/ccf:init` … qua namespace plugin), cập nhật đồng bộ mọi tham chiếu + regex/reason hook + test, KHÔNG đụng agent `ccf-*` hay tên plugin `ccf`.

## ⚠️ RANH GIỚI TUYỆT ĐỐI (đọc trước khi sửa)
Chỉ đổi ĐÚNG 6 TOKEN LỆNH sau (ở dạng `/ccf:ccf-X`, `/ccf-X` bare, và prose ``` `ccf-X` ```):
`ccf-init`, `ccf-plan`, `ccf-check`, `ccf-fix`, `ccf-updatespec`, `ccf-cook`.
**TUYỆT ĐỐI KHÔNG đổi** (đây là agent/skill/plugin, KHÔNG phải lệnh):
`ccf-implementer`, `ccf-spec-checker`, `ccf-codebase-analyzer`, `ccf-best-practice-researcher`, `ccf-spec-writer`, `ccf-debugger`, `grill-me`, và tên plugin/namespace `ccf` (marketplace/plugin.json `"name": "ccf"`, `mcp__plugin_ccf_*`). → KHÔNG dùng `sed s/ccf-//g` mù. Grep từng token cụ thể.
Lưu ý phân biệt: `ccf-check` KHÁC `ccf-spec-checker` (token `ccf-check` không nằm trong `ccf-spec-checker`); `ccf-checker` không tồn tại.

## Quy tắc thay thế
- `/ccf:ccf-plan` → `/ccf:plan` (và tương tự 5 lệnh còn lại).
- bare `/ccf-plan` → `/ccf:plan` (dạng bare thành namespaced — vì sau rename lệnh chỉ gọi được qua `/ccf:plan`).
- prose ``` `ccf-plan` ``` / "ccf-plan step 6" → `plan` / "`/ccf:plan` step 6" (dùng phán đoán để câu vẫn đúng ngữ pháp).

## Acceptance criteria (verifiable)
- [ ] `git mv` 6 file: `commands/ccf-init.md`→`commands/init.md`, `ccf-plan.md`→`plan.md`, `ccf-check.md`→`check.md`, `ccf-fix.md`→`fix.md`, `ccf-updatespec.md`→`updatespec.md`, `ccf-cook.md`→`cook.md`. (Frontmatter các file này KHÔNG có field `name` cho command — tên lệnh = tên file — nên chỉ cần rename file; kiểm tra lại.)
- [ ] **Hook logic + regex** cập nhật sang tên mới:
  - `plan-mode-guard.mjs`: regex khớp `/ccf:plan` (thay `/ccf-plan`+`/ccf:ccf-plan`). Neo chặt để không over-match chữ "plan" thường.
  - `lib/review-trace.mjs#hasCcfPlanCommand` (+ `review-trace.test.mjs`): nhận `/ccf:plan`.
  - `lib/verify-chain.mjs#buildVerifyReason` (+ `verify-chain.test.mjs`): reason nêu `/ccf:check`, `/ccf:updatespec`.
  - `auto-verify.mjs` systemMessage + `updatespec-nudge.mjs` reason + `session-start.mjs` (mọi ref lệnh) sang tên mới.
  - `hooks.json` description (nhắc `/ccf-plan` → `/ccf:plan`).
- [ ] **Bodies + cross-ref**: 6 command mới tự tham chiếu lẫn nhau (vd `plan.md` nhắc `/ccf:check`→`/code-review`→`/ccf:updatespec`; `cook.md`; `updatespec.md`), 6 agent `.md` (ref lệnh trong prose), `skills/grill-me/SKILL.md` (description "invoked by … ccf-plan/ccf-fix/ccf-init" → plan/fix/init), `.claude/rules/*` (tooling.md self-checks, architecture.md, components.md naming-convention, git-workflow.md, hooks.md), 3 root README + `plugins/ccf/README.md` (bảng lệnh), `CLAUDE.md`, `AGENTS.md`, templates (nếu ref lệnh), `PLAN.md` (ref sống; narration lịch sử có thể để, nhưng grep-consistency ưu tiên đổi hết cho sạch).
- [ ] **Version bump 0.6.0 → 0.7.0** (breaking rename): `package.json`, `plugins/ccf/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `package-lock.json` (2 dòng self-ref).
- [ ] `plugin.json` KHÔNG liệt kê command (auto-discover theo filename) — xác nhận không cần sửa danh sách; chỉ version.

## Test first
Cập nhật `review-trace.test.mjs` + `verify-chain.test.mjs` TRƯỚC (đổi assert sang tên lệnh mới) → chạy đỏ (logic cũ còn tên cũ) → sửa lib cho xanh. Mutation-check giữ nguyên.

## Steps
1. Sửa test (đỏ) → sửa hook lib/regex (xanh).
2. `git mv` 6 file + sửa body + mọi cross-ref (grep từng token, tôn trọng ranh giới).
3. Version bump 4 chỗ.
4. Gate: `node --test` + `tsc` + `validate` + smoke plan-mode-guard(`/ccf:plan`→block nếu không plan mode) + plan-review-gate + grep không còn `/ccf:ccf-`/`/ccf-plan`/`ccf-cook`… dạng sống.
5. Status `in-review`.

## Notes
- Nghịch với v0.5.0 (từng rename `/cook`→`/ccf-cook`) — user đổi ý, giờ bỏ prefix cho cả 6, dựa vào namespace `/ccf:`.
- Return-format kết thúc bằng `TEST-RESULT: <cmd> → <counts>` (ghim ở agent body).
