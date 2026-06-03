# Task 024 — context-guard bỏ qua usage cũ hơn compact_boundary

- **Vertical slice:** pure lib helper (`isCompactBoundary` + 1 nhánh trong `readContextUsage`) → test failing-first → hook tiêu thụ (KHÔNG đổi) → docs sync
- **Depends on:** — (none; độc lập với backlog 022/023/022a — tập file rời nhau, chỉ giao ở `CLAUDE.md`/`PLAN.md` narrative)
- **Spec refs:** `hooks.md` (context-guard bullet + invariants no-build/no-dep + best-effort never-throw); `coding-conventions.md` (pure helper, JSDoc, KISS/YAGNI); `testing.md` (branchy logic → pure helper tested `node --test`, failing-first); memory [[heuristic-copy-drift-smoke-reveals]], [[subagent-spawn-tool-named-agent]]
- **Implemented by:** ccf-implementer (session sạch), then `/ccf:ccf-check` + `/code-review`
- **Gate (must be GREEN trước khi sang 024a):**
  - `node --test plugins/ccf/hooks/lib/*.test.mjs` — toàn bộ xanh (test mới + 107 baseline)
  - `npx -p typescript tsc --noEmit` — exit 0
  - Smoke stdin: transcript tạm `...assistant(token lớn) → compact_boundary` cuối file → JSON `{transcript_path,prompt,cwd}` vào `context-guard.mjs` → KHÔNG cảnh báo, exit 0; nối assistant token nhỏ SAU boundary → chạy lại → đo lại đúng
  - `claude plugin validate plugins/ccf` — accepted
  - Grep-consistency: `compact_boundary` ở `hooks.md` VÀ `CLAUDE.md`; không còn mô tả bug "ngay sau compact vẫn cảnh báo" dạng vấn đề mở

## Goal (one sentence)
`readContextUsage` trả `null` khi — lúc duyệt ngược transcript — gặp một dòng `compact_boundary` TRƯỚC dòng `assistant` mang `message.usage`, để ngay sau `/compact` (chưa có lượt assistant mới) hook im lặng thay vì cảnh báo token cũ trước nén.

## Root cause (grounded)
`/compact` không tạo transcript mới — chèn `{type:"system",subtype:"compact_boundary",compact_metadata:{trigger,pre_tokens}}` vào cùng file rồi tiếp tục ghi (grounded `code.claude.com/docs/en/hooks` PostCompact + agent-sdk `SDKCompactBoundaryMessage`). Prompt đầu sau compact kích `UserPromptSubmit` TRƯỚC khi có dòng assistant mới → hook đọc dòng assistant phía trên boundary → token cũ (lớn). Docs `prompt-caching` xác nhận turn sau compact mang summary ngắn → một khi có assistant mới, token đã nhỏ → đo đúng.

## Design (predicate HẸP — chốt sau review)
```js
// Pure, exported để test. HẸP: đúng shape doc, KHÔNG fallback compact_metadata (tránh âm thầm tắt cảnh báo).
// Trigger manual|auto đều là boundary — KHÔNG lọc trigger.
export function isCompactBoundary(obj) {
  return obj?.type === "system" && obj?.subtype === "compact_boundary";
}
```
Trong vòng duyệt ngược của `readContextUsage`, SAU `JSON.parse`, kiểm tra boundary TRƯỚC nhánh assistant:
```js
if (isCompactBoundary(obj)) return null; // vừa compact, chưa có lượt assistant mới
if (obj?.type !== "assistant") continue;
```
Duyệt ngược ⇒ "dừng ở marker gặp trước": assistant mới hơn boundary → đọc token đã-nén; boundary mới hơn → `null`. Không cần state.

## Acceptance criteria (verifiable)
- [ ] `context-usage.mjs`: thêm `isCompactBoundary(obj)` (export, JSDoc) + 1 nhánh `return null` trong `readContextUsage`; JSDoc của `readContextUsage` nêu rõ "boundary mới hơn assistant → null".
- [ ] KHÔNG đổi logic `context-guard.mjs` (đã có `if (!usage) process.exit(0)` ở dòng 21).
- [ ] `context-usage.test.mjs`: thêm 6 nhóm test (xem dưới), 107 baseline vẫn xanh.
- [ ] `hooks.md` context-guard bullet + `CLAUDE.md` "Current plan" có mô tả compact_boundary; README chỉ sửa NẾU có dòng context-guard nội bộ (nếu không → bỏ qua, YAGNI).
- [ ] `MEMORY.md`: ghi shape `compact_boundary` thật quan sát được + bài học.

## Test first (write before implementing) — failing-first
1. boundary là dòng CUỐI, trên nó có assistant-usage cũ → `null`.
2. assistant-usage MỚI hơn boundary (assistant SAU boundary, cuối file) → đọc token mới, KHÔNG null.
3. Composite ordering: `assistant(nhỏ, mới nhất) → boundary → summary(usage lớn)` → bỏ qua summary (Bug #4) + dừng đúng → chứng minh 2 nhánh `if` compose, không đảo được thứ tự.
4. Boundary-no-assistant: chỉ `user` + `boundary` → `null`.
5. Nhiều boundary liên tiếp: `assistant(cũ) → boundary → boundary` → `null`.
6. `isCompactBoundary` unit: true `{type:"system",subtype:"compact_boundary"}`; FALSE `{compact_metadata:{}}`, assistant/user/summary line, `null`, `{}`.
7. Regression: Bug #4 (`:91-103`), Bug #5 (`:105-116`), sum-last, no-usage (`:70-80`) vẫn xanh.

## Files to touch
- `plugins/ccf/hooks/lib/context-usage.mjs`, `plugins/ccf/hooks/lib/context-usage.test.mjs`
- `.claude/rules/hooks.md`, `CLAUDE.md`, `.claude/plan/PLAN.md`, (README có điều kiện), `MEMORY.md`

## Steps (thin end-to-end slice)
1. Viết 6 nhóm test failing-first vào `context-usage.test.mjs`; chạy `node --test` thấy đỏ đúng chỗ.
2. Thêm `isCompactBoundary` + nhánh `return null` vào `context-usage.mjs`; chạy lại → xanh.
3. `npx -p typescript tsc --noEmit`; smoke stdin 2 ca; `claude plugin validate plugins/ccf`.
4. Docs sync (hooks.md + CLAUDE.md + PLAN.md; README có điều kiện) + grep-consistency.
5. `/ccf:ccf-check` → `/code-review`. (KHÔNG đóng iteration — chờ 024a live verify; `/ccf:ccf-updatespec` chỉ ghi `done` sau 024a.)

## Notes / best-practice sources
Grounded Context7 `/websites/code_claude` (compact_boundary shape + cache-invalidation). Predicate HẸP cố ý: bài học Bug #4 + [[heuristic-copy-drift-smoke-reveals]] (heuristic lỏng âm thầm tắt cảnh báo, chỉ smoke e2e lộ). [[subagent-spawn-tool-named-agent]] phủ ở 024a (fixture thật từ harness).
