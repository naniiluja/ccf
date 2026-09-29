# Task 061 — Jev xác minh từng `FAIL:` (chỉ chú thích)

- **Vertical slice:** lib thuần (`hooks/lib/finding-verify.mjs`) + script human-run (`scripts/jev-verify-findings.mjs`) + test + `check.md` bước 6b + đồng bộ số script 2 sang 3
- **Depends on:** 060
- **Spec refs:** `.claude/rules/architecture.md` (script vs hook), `.claude/rules/tooling.md` (TypeSafe Jev, `jev-slice-check.mjs`), `hooks/lib/jev-client.mjs`, `hooks/lib/completion-evidence.mjs` (lọc file nhạy cảm, trần 80KB)
- **MCP to use:** none (gọi api.typesafe.ai qua `fetch`, cần `TYPESAFE_API_KEY`)
- **Gate (must be GREEN before the next slice):** ba bộ `node --test`; `tsc`; `validate`; một lần chạy có key trên báo cáo eval, hoặc ghi "chưa quan sát"

## Goal (one sentence)
Mỗi `FAIL:` của checker có thêm điểm Jev cho câu "diff này chứa đúng lỗi được mô tả", để người đọc thấy finding nào đáng nghi.

## Acceptance criteria (verifiable)
- [x] `parseFailFindings` tách `FAIL:`, `file:line` và rule được quote; `buildFindingQuestions` một câu hỏi mỗi FAIL; `annotate` gắn điểm.
- [x] Script đọc báo cáo từ stdin, lấy `git diff <base>...HEAD`, tái dùng bộ lọc file nhạy cảm, trần 80KB và `askJev`; in JSON; luôn `exit 0` với lý do `no-key`/`too-large`/`error` trong JSON.
- [x] Jev không bao giờ hạ hay xóa một `FAIL:`; FAIL dưới 0.5 chỉ kèm ghi chú "Jev không xác nhận (0.xx), cần người xem".
- [x] `check.md` bước 6b chạy script chỉ khi có `TYPESAFE_API_KEY`, và báo diff rời máy tới api.typesafe.ai.
- [x] Số script 3 khớp ở `CLAUDE.md`, `architecture.md`, `tooling.md`, 3 README; script có trong `tsconfig.json` `include`.

## Test first (write before implementing)
`finding-verify.test.mjs` (parse, câu hỏi, gắn điểm, `fetch` giả) và test script với máy chủ `node:http` giả trên 127.0.0.1, theo mẫu `slice-check-script.test.mjs`.

## Files to touch
- `plugins/ccf/hooks/lib/finding-verify.mjs` + `.test.mjs`, `plugins/ccf/scripts/jev-verify-findings.mjs` + test
- `plugins/ccf/commands/check.md`, `tsconfig.json`, `CLAUDE.md`, `.claude/rules/{architecture,tooling}.md`, `README.md`, `README.vi.md`, `README.zh-CN.md`, `plugins/ccf/README.md`

## Notes / best-practice sources
Lượt xác minh từng finding: claude-code `code-review` bước 5-6, claude-code-security-review filter sub-task. Quyết định "chú thích, không hạ mức": superpowers ("a stated rationale never downgrades a finding's severity").

## Results
**Đã làm (2026-09-29):**
- `hooks/lib/finding-verify.mjs` (thuần): `parseFailFindings` (bỏ qua dòng trong code fence, lấy `path:NN` đầu tiên và câu quote đầu tiên), `buildFindingQuestions` (lọc file nhạy cảm, trần 80KB; bỏ qua với lý do `no-findings`/`empty-diff`/`too-large` chứ không cắt diff), `annotateFindings` (mỗi finding vào đúng một bản ghi, luôn `marker: "FAIL:"`, `verdict` là `confirmed`/`not-confirmed`/`unjudged`, ngưỡng 0.5 tính cả mốc 0.5).
- `scripts/jev-verify-findings.mjs`: đọc báo cáo từ stdin, lấy `git diff <base>...HEAD` (mặc định `main`, rồi `master`), dùng lại `askJev`, luôn exit 0. Timeout 30s, vì script không bị hạn chót 10s như hook. JSDoc `@returns {never}` cho `done()` để `tsc` thu hẹp kiểu.
- `check.md` bước 6b: chỉ chạy khi có key và có `FAIL:`; báo diff rời máy; tìm script bằng Glob (`components.md` cấm dựa vào `${CLAUDE_PLUGIN_ROOT}` trong thân command); chỉ gắn `note`, không xóa hay hạ `FAIL:`.
- Số script 2 → 3: `CLAUDE.md` (cây thư mục, danh sách lib, dòng Counts), `architecture.md`, `tooling.md` (mục mới), `README.md`, `README.vi.md`, `README.zh-CN.md`, `plugins/ccf/README.md`. `tsconfig.json` đã có glob `plugins/ccf/scripts/**/*.mjs`, không cần sửa.

**Test trước:** `finding-verify.test.mjs` đỏ vì chưa có module, sau đó 6/6 xanh. `finding-verify-script.test.mjs` đỏ 5/5, sau đó 5/5 xanh. Có fake `node:http` trên 127.0.0.1 và repo git tạm, kiểm: key không bị in ra, `.env` bị lọc khỏi diff, 429 vẫn trả đủ finding ở dạng `unjudged`, base sai hoặc không có repo thì trả `no-diff`.

**Gate:** hook lib 246 pass, 0 fail; template 8 pass; `.claude/tests` 10 pass; `tsc` exit 0; `validate` passed; md5 khối văn phong khớp 7 bản; quét codepoint 0 hit; ccf-budget đo lại, paid = 96659; `CLAUDE.md` 59 dòng, 11827 byte (dưới 12KB, sát ngưỡng).

**Chạy thật có key: CHƯA QUAN SÁT được câu trả lời của Jev.** Có `TYPESAFE_API_KEY`, và em chạy trên fixture eval (code giả, có đáp án): case 04 với một FAIL đúng, case 06 (diff sạch) với hai FAIL bịa. Cả hai lần đều `reason: "timeout"` sau 30s. `curl` không kèm key tới `api.typesafe.ai` cũng treo 20s sau khi TCP nối được ngay. Container ra ngoài qua proxy HTTPS (npm registry qua được), nên nhiều khả năng proxy chặn host này. Điều đã quan sát được: đường timeout thật chạy đúng (exit 0, finding giữ `FAIL:`, `verdict: "unjudged"`, kèm note). Việc cần làm trên host có mạng: chạy lại đúng hai lệnh trên fixture `/tmp/jevlive`, kỳ vọng case 04 `confirmed`, còn hai FAIL bịa ở case 06 `not-confirmed`.
