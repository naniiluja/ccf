# Task 062 — Đồng bộ changelog Claude Code còn lại vào spec

- **Vertical slice:** rule trả phí mỗi phiên (`tooling.md`, `components.md`, `architecture.md`) + `CLAUDE.md` `## Current plan`
- **Depends on:** 061
- **Spec refs:** `CHANGELOG.md` của anthropics/claude-code, các bản 2.1.215, 2.1.218, 2.1.232, 2.1.246, 2.1.269, 2.1.271, 2.1.274, 2.1.284
- **MCP to use:** none
- **Gate (must be GREEN before the next slice):** mỗi câu mới có số phiên bản; `grep` không còn câu "since v2.1.218" sai về `/code-review`; `wc -lc CLAUDE.md .claude/rules/*.md` đo lại, nhãn `ccf-budget` cập nhật, `node --test .claude/tests/*.test.mjs` xanh

## Goal (one sentence)
Spec phản ánh đúng hành vi Claude Code 2.1.284 ở những điểm ảnh hưởng tới review và agent của CCF.

## Acceptance criteria (verifiable)
- [x] `/code-review`: 2.1.215 không tự chạy; 2.1.232 mức cao chạy nền; 2.1.246 tự khởi chạy được trên Bedrock/Vertex/Foundry; 2.1.274 prompt inline gọn thay nhiều subagent.
- [x] `/ultrareview` là cloud session có tính phí, `--post` đăng comment trực tiếp (2.1.269), hợp nhất với câu `ultra` hiện có.
- [x] Ghi chú Background-by-default có mốc 2.1.232.
- [x] `omitClaudeMd` (2.1.271): quyết định không dùng cho cả 4 agent, kèm lý do.
- [x] `background: false` (2.1.218) chỉ cho skill `context: fork`; CCF không có skill fork.
- [x] Ghim Opus: `ANTHROPIC_DEFAULT_OPUS_MODEL` cho `model: opus` trên Bedrock/Vertex/Foundry (2.1.274, 2.1.284).
- [x] `CLAUDE.md` `## Current plan` phản ánh iteration này.

## Test first (write before implementing)
`grep -n "2.1.218" .claude/rules/tooling.md` trước khi sửa, để thấy câu sai còn đó.

## Files to touch
- `.claude/rules/tooling.md`, `.claude/rules/components.md`, `.claude/rules/architecture.md`, `.claude/rules/prompt-standard.md` (nhãn `ccf-budget`), `CLAUDE.md`

## Results
**Nguồn:** tải thẳng `https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md` (2026-09-29, 837921 byte, đầu file là 2.1.284) và đọc nguyên văn từng bản 2.1.215, 2.1.218, 2.1.232, 2.1.246, 2.1.269, 2.1.271, 2.1.274, 2.1.284.

**Đính chính tiền đề của task:** câu "Since v2.1.218 it runs as a background subagent" trong `tooling.md` KHÔNG sai. Changelog 2.1.218 ghi nguyên văn "Changed `/code-review` to run as a background subagent". Vì vậy tiêu chí "grep hết câu sai 2.1.218" không còn cơ sở: câu đó được giữ lại và bổ sung thêm. Bước test-first (thấy câu còn ở `tooling.md:45`) đã chạy trước khi sửa.

**Đã ghi, mỗi câu kèm số phiên bản:**
- `tooling.md` `code-review`: high/xhigh/max chạy nền (2.1.232); Claude không tự chạy nữa (2.1.215); được tự chạy lại chỉ trên Bedrock/Vertex AI/Foundry hoặc khi tắt telemetry (2.1.246); prompt inline gọn thay cho nhiều subagent với model chưa được tinh chỉnh (2.1.274); `/ultrareview` được gọi là cloud session (2.1.274); `--post` đăng comment trực tiếp (2.1.269). Câu "billed cloud review" có từ trước, changelog không nói, nên em giữ nguyên, không thêm.
- `architecture.md` Background-by-default: 2.1.232 áp cho mọi spawn không phải teammate trong phiên interactive, và cùng bản đó bật `subagent_type: "fork"` mặc định.
- `components.md`: `background: false` chỉ có tác dụng cho skill `context: fork` (2.1.218), CCF không có skill fork; `omitClaudeMd` (2.1.271) cố ý không dùng cho cả 4 agent, kèm lý do; `ANTHROPIC_DEFAULT_OPUS_MODEL` cho `model: opus` trên Bedrock/Vertex/Foundry (2.1.274), và cách đổi model an toàn khi đang ghim Opus (2.1.284).
- `CLAUDE.md` `## Current plan`: sửa câu Live iteration (058/059 đóng theo lệnh, eval chưa chứng minh recall, 060 đến 062 chờ một lần `/ccf:check`). Chỉ thay câu, không thêm đoạn, vì file sát trần.

**Gate:** ccf-budget đo lại, paid = 98345; `CLAUDE.md` 59 dòng, 11979 byte (< 12288, còn khoảng 300 byte); `.claude/tests` 10 pass; hook lib 246 pass; `tsc` exit 0; `validate` passed.
