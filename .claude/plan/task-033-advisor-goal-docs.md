# Task 033 — Khuyến nghị lệnh official tùy chọn: `/advisor` (cross-model review) + `/goal` (điều kiện dừng)

- **Vertical slice:** prompt/doc thuần — thêm 2 khuyến nghị lệnh runtime official vào đúng chỗ + ghi `tooling.md`. Cohesive (cùng chủ đề "surface optional official CC command"), gộp theo luật right-size (reviewer xác nhận HỢP LỆ — không driver tách).
- **Depends on:** — (task đầu iteration)
- **Spec refs:** `commands/ccf-plan.md` step 6, `commands/ccf-check.md`, `commands/ccf-cook.md` §8, `.claude/rules/tooling.md`; plan `~/.claude/plans/hi-n-t-i-t-nh-n-ng-compiled-blanket.md` Phần 1+3.
- **Implemented by:** `ccf-implementer` (alias `sonnet`). MCP: Context7 (`query-docs`) để re-ground `/advisor`+`/goal` lúc implement.
- **Gate (must be GREEN before task 034):** grep thấy `/advisor` ở `ccf-plan.md`+`ccf-check.md`+`tooling.md` và `/goal` ở `ccf-cook.md`+`tooling.md`; `claude plugin validate plugins/ccf` pass; `npx -p typescript tsc --noEmit` exit 0 (baseline); `node --test plugins/ccf/hooks/lib/*.test.mjs` baseline pass; cross-read xác nhận `ccf-spec-checker` (ccf-plan step 6) + stop-on-red (ccf-cook) vẫn là gate BẮT BUỘC — khuyến nghị KHÔNG hạ cấp gate hiện có.

## Goal (one sentence)
Ghi hai lệnh official Claude Code — `/advisor` (review cross-model) và `/goal` (điều kiện dừng) — như TÙY CHỌN tăng cường trong đúng prompt CCF + `tooling.md`, tuyệt đối không thay thế gate bắt buộc nào.

## Acceptance criteria (verifiable)
- [ ] `commands/ccf-plan.md` step 6: thêm 1 câu — bật `/advisor sonnet|fable` để review-đối-nghịch bằng model KHÁC BỔ SUNG cho `ccf-spec-checker` (same-model); nêu rõ KHÔNG thay `ccf-spec-checker` (vẫn là gate bắt buộc + hook `plan-review-gate`).
- [ ] `commands/ccf-check.md`: 1 câu tương tự cho review implementation (tùy chọn cross-model).
- [ ] `commands/ccf-cook.md` §8: 1 câu — có thể đặt `/goal` (vd "dừng khi mọi task in-review") làm điều kiện dừng PHỤ; KHÔNG thay stop-on-red-gate (luật CCF tuyệt đối).
- [ ] `.claude/rules/tooling.md`: entry "**/advisor** — when to use — how to call" + entry "**/goal** — …" theo format "name — when to use — how to call".
- [ ] Prose viết dạng **"OPTIONAL, có thể vắng trên version Claude Code cũ"**, KHÔNG nhúng số version cứng vào câu — re-ground qua docs official lúc implement ([[ground-claude-facts-primary-not-blog]]).
- [ ] Doc-sync: nếu README liệt kê lệnh/tool thì cập nhật; count artifact KHÔNG đổi (không thêm command/agent/hook/skill).

## Test first (write before implementing)
N/A — slice prose thuần, KHÔNG có test surface. Report cuối phải ghi `TEST-RESULT: n/a (no test surface)` (theo Return-format ghim ở 034 — nhưng 033 chạy TRƯỚC 034, nên nếu 034 chưa ghim thì implementer vẫn nêu rõ "prose-only, no test"). "Verify" = grep + đọc lại + `validate`/`tsc`/`node --test` baseline chống hồi quy.

## Files to touch
- `plugins/ccf/commands/ccf-plan.md` — step 6: câu `/advisor` tùy chọn cross-model
- `plugins/ccf/commands/ccf-check.md` — câu `/advisor` tùy chọn
- `plugins/ccf/commands/ccf-cook.md` — §8: câu `/goal` tùy chọn
- `plugins/ccf/.mcp.json`/`allowed-tools`? — KHÔNG cần (lệnh runtime, không phải tool)
- `.claude/rules/tooling.md` — 2 entry mới
- (điều kiện) root README nếu có bảng lệnh

## Steps (thin end-to-end slice)
1. Re-ground `/advisor` + `/goal` qua Context7 docs official (xác nhận cú pháp + "optional/version-gated").
2. Viết prose vào 4 file + tooling.md (imperative, ngắn, không hạ cấp gate).
3. Grep + đọc lại; chạy `validate` + `tsc` + `node --test` baseline.
4. Đặt PLAN.md status 033 = `in-review`. `done` chỉ do `/ccf:ccf-updatespec` sau review.

## Notes / best-practice sources
- [commands](https://code.claude.com/docs/en/commands) + [changelog](https://code.claude.com/docs/en/changelog): `/advisor [opus|sonnet|fable|off]` (v2.1.98+), `/goal <condition>` (v2.1.181+).
- [[ground-claude-facts-primary-not-blog]], [[user-delegates-pick-best-practice-not-complex]].
