# Task 059 — Nâng chất báo cáo `ccf-spec-checker`

- **Vertical slice:** agent prompt (`ccf-spec-checker.md`) + command đọc báo cáo (`check.md` bước 6) + bảng từ vựng (`prompt-standard.md`) + eval grader
- **Depends on:** 058
- **Spec refs:** `.claude/rules/prompt-standard.md` (bảng heading, "both ends move together", khối văn phong md5 `deac0ef73d3c0cb9d26766027a906385`), `plugins/ccf/agents/ccf-codebase-analyzer.md:72-77` (mẫu mục bắt buộc)
- **MCP to use:** none
- **Gate (must be GREEN before the next slice):** suite eval 058 chạy lại, recall không giảm và false positive case 6 không tăng so với baseline; grader mới RED trên output baseline; md5 7 bản khối văn phong khớp; `claude plugin validate plugins/ccf`

## Goal (one sentence)
Checker chỉ ra `FAIL:` khi tin cậy từ 80 trở lên và đã quote nguyên văn rule, đồng thời khai rõ những gì nó không phán xét.

## Acceptance criteria (verifiable)
- [x] Rubric 0/25/50/75/100 chép nguyên văn (nguồn: claude-code `b85cc4474f`); `FAIL:` cần điểm ≥ 80 và câu quote rule hoặc tiêu chí kèm vị trí; 50 đến 79 là `WARN:`; dưới 50 bỏ nhưng ghi lý do; tác động cao mà tin cậy thấp giữ ở `WARN:` kèm điều chưa chắc.
- [x] Danh sách không flag: lỗi có từ trước, dòng diff không chạm, thứ linter hoặc `tsc` bắt, thay đổi có chủ đích gắn với task, rule đã tắt trong code, mối lo chất lượng chung spec không yêu cầu; lời giải thích của người implement không hạ mức finding.
- [x] Sổ đối chiếu tiêu chí: mỗi tiêu chí của task là đạt, không đạt (Missing/Extra/Misunderstood) hoặc không xác minh được từ diff.
- [x] Heading bắt buộc `### Declined to judge`, chỉ ghi "none" khi thật sự không có; dòng "Checked for …".
- [x] Sửa câu sai ở `ccf-spec-checker.md:44` (verify-chain chỉ in chữ `FAIL:`, không đọc marker).
- [x] `check.md` bước 6 và bảng heading trong `prompt-standard.md` có heading mới.

## Test first (write before implementing)
Grader `regex` mới bắt `### Declined to judge` và một rule được quote; chạy trên output baseline của 058 và thấy RED.

## Files to touch
- `plugins/ccf/agents/ccf-spec-checker.md`, `plugins/ccf/commands/check.md`, `.claude/rules/prompt-standard.md`
- `plugins/ccf/evals/*/graders/` — grader mới
- `plugins/ccf/README.md` nếu có mô tả format báo cáo

## Notes / best-practice sources
anthropics/claude-code `plugins/code-review` (hiện tại và `b85cc4474f`), `pr-review-toolkit/agents/code-reviewer.md`, anthropics/claude-code-security-review, The-PR-Agent/pr-agent `pr_reviewer_prompts.toml`, obra/superpowers `code-reviewer.md` + `task-reviewer-prompt.md`.

## Results
**Đã triển khai (2026-09-29):**
- `ccf-spec-checker.md`: mục mới `## Scoring each candidate finding` với rubric 0/25/50/75/100 chép nguyên văn từ `plugins/code-review/commands/code-review.md` ở commit `b85cc4474f` (tải lại trực tiếp, không chép theo trí nhớ). Có quote-trước-khi-chấm, `FAIL:` cần điểm ≥ 80 và câu quote, `WARN:` 50 đến 79, ngoại lệ tác động cao, dưới 50 vào `### Declined to judge`. Danh sách 6 thứ không flag; riêng mục linter ghi rõ test đỏ KHÔNG thuộc lớp này, vì bản gốc có "broken tests" mà checker của CCF tự chạy test. Return format có `### Acceptance criteria` (kèm dòng `Extra:`), `### Declined to judge` bắt buộc, dòng `Checked for:`. Câu sai ở dòng 44 đã sửa: verify-chain chỉ in chữ `FAIL:`, không đọc báo cáo.
- `check.md` bước 6: thêm 2 heading, dòng `Checked for:`, và câu cấm tự nâng/hạ tier khi không có bằng chứng mới.
- `prompt-standard.md`: 2 hàng mới trong bảng heading, một câu về ngưỡng; sửa luôn câu "verify-chain READ them" ở cuối mục (cùng lỗi với dòng 44).
- README không mô tả format báo cáo nên không đổi.
- Grader mới: `declined-section.md` (regex `### Declined to judge`) ở cả 6 case, `quoted-rule.md` (regex `FAIL:[^\n]*"[^"\n]{8,}"`) ở case 04. Lưu ý: threshold của suite là 1, nên grader mới làm điểm case khó đạt hơn baseline. So sánh recall phải dùng riêng grader `found-defect`, và false positive dùng riêng `no-false-positive`.

**Gate tĩnh, chạy thật:** md5 cả 7 bản khối văn phong = `deac0ef73d3c0cb9d26766027a906385`; `claude plugin validate plugins/ccf` passed; quét codepoint 0 hit; `node --test .claude/tests/*.test.mjs` 10 pass; `node --test plugins/ccf/hooks/lib/*.test.mjs` 234 pass, 0 fail. `prompt-standard.md` không nằm trong phần trả phí nên nhãn `ccf-budget` không đổi (test vẫn xanh).

**CHƯA QUAN SÁT, gate chưa xanh:**
- Chạy lại suite eval so với baseline 058 (recall `found-defect` 14/15, false positive case 06 0/3). Container này không có `bwrap`, nên phải chạy trên host:
  `cd plugins/ccf && env -u ANTHROPIC_API_KEY claude plugin eval . --scaffold --ablation none --allow-tools Bash --runs 3 --max-cost-usd 8 --no-publish --trust-plugin`
- Grader mới RED trên checker cũ: output của baseline đã mất cùng `/tmp`, nên không chấm lại được. Cách quan sát: chạy `--case 04-rule-violation --runs 1` với bản `ccf-spec-checker.md` và `check.md` của HEAD (trước 059), kỳ vọng `declined-section` và `quoted-rule` RED.
- Rủi ro cần xem khi có số: mốc 75 của rubric ("directly mentioned in the relevant CLAUDE.md") nằm dưới ngưỡng 80, nên một vi phạm rule rõ ràng có thể bị hạ thành `WARN:` và làm tụt recall case 04.

**Eval gate lần 1 (2026-09-29, chạy trên host, kết quả `evals/results/2026-09-29T13-35-15-807Z/`): ĐỎ.**
Số liệu lấy từ tóm tắt người vận hành gửi lại. Thư mục kết quả và `/tmp/eval059.log` thuộc root với quyền `rw-rw----`, nên phiên này không đọc được để tự xác minh. Có thêm một thư mục `2026-09-29T13-34-20-599Z` cũng không đọc được.
- 18 run, 1413 giây, 6.22 USD, `partial: false`, 5/6 case pass, `overallScore` 0.944 (baseline 0.972).
- `found-defect` 12/15, baseline 14/15: **recall giảm**. Case 03 (scope creep) trượt cả 3 run. Case 04 đạt cả 4 grader 3/3, kể cả `quoted-rule`.
- `no-false-positive` case 06: 3/3, không có false positive.
- Grader mới `declined-section` pass, kể cả ở case 03.

**Chẩn đoán (suy luận, chưa xác nhận bằng trace):** thay đổi ngoài phạm vi ở `src/logger.js` gần như vô hại (thêm tiền tố `[app]` và một hàm `debug` rỗng). Rubric gốc chấm theo tác động: mốc 50 là "nitpick… not very important", mốc 75 đòi "directly mentioned in the relevant CLAUDE.md", mà tiêu chí scope của fixture lại nằm trong task file. Vì vậy finding bị chấm dưới 80 và rơi xuống `WARN:`. Case 04 không bị ảnh hưởng vì rule `console.log` nằm trong một file rule mà `CLAUDE.md` import.

**Bản sửa (rubric vẫn giữ nguyên văn):**
- "the relevant CLAUDE.md" được định nghĩa là toàn bộ spec, bao gồm cả acceptance criteria của task file.
- Thêm một đoạn: với vi phạm spec, điểm đo mức chắc chắn rằng rule bị vi phạm, không đo tác hại khi chạy. Rule đã quote mà diff cho thấy bị vi phạm thì chấm 100.
- Ví dụ trong đoạn này cố ý viết tổng quát ("a scope limit, a forbidden call or a naming rule"), không chép tiêu chí của fixture, để khỏi dạy prompt theo đúng bài eval.
- Gate tĩnh sau khi sửa: 7 bản khối văn phong cùng md5 `deac0ef7…`, `validate` passed, quét codepoint sạch.

**Cần làm tiếp, trên host:** chạy lại cả suite với lệnh đã ghi ở trên. Gate xanh khi `found-defect` đạt từ 14/15 trở lên, case 03 bắt được ít nhất 2/3, và `no-false-positive` giữ 3/3.
- Rủi ro của bản sửa: checker có thể nâng thành `FAIL:` những vi phạm rule thật nhưng nhỏ nhặt. Case 06 chỉ đo false positive trên một diff hoàn toàn sạch, nên không bắt được loại lỗi này.
- Container này có `bwrap` nhưng vẫn hỏng ở bước tạo loopback (`RTM_NEWADDR`), nên không chạy eval ở đây được.

**Confound môi trường (người vận hành xác minh trên host, 2026-09-29):** trong sandbox eval của host, mọi lệnh `git` đều chết với lỗi bwrap `Can't create file at /usr/lib/git-core/git: Permission denied`. Checker không chạy được `git diff`, nên không xác minh được scope creep và chỉ dám để `WARN:` với confidence 55. Baseline 058 đo ở một môi trường khác (trước khi thay máy), và trace của nó đã mất, nên không biết lúc đó git có chạy không. **So 12/15 với 14/15 vì thế không hợp lệ.** Chẩn đoán "rubric hạ finding xuống WARN" ở trên chỉ đúng một phần: finding bị hạ vì thiếu bằng chứng diff, chứ không vì cách chấm tác động.

**Đối chứng cùng môi trường:** người vận hành stash thay đổi của 059, chạy case 03 bằng checker CŨ trong cùng sandbox host, rồi pop stash lại. Checker cũ cũng trượt `found-defect`. Điểm case 0.33, so với 0.67 của bản mới. Chênh lệch này đến từ grader `declined-section`: checker cũ không bao giờ in heading đó, nên nó không cho thấy bản mới bắt lỗi tốt hơn. Chưa rõ lần chạy bản mới dùng để so là trước hay sau bản sửa rubric.

**Đóng theo lệnh người dùng (2026-09-29).** Đánh giá: trong cùng môi trường, ở case 03, không thấy regression do prompt (cả cũ lẫn mới đều trượt vì git hỏng). Case 04 đạt 3/3 với grader `quoted-rule` mới. Case 06 không có false positive. Gate tĩnh xanh.

**Chưa quan sát, được chấp nhận để lại:**
- recall của cả suite so với checker cũ trong một môi trường có git chạy được;
- bản sửa rubric (vi phạm spec chấm theo mức chắc chắn) chưa từng chạy qua eval;
- grader mới RED trên checker cũ chỉ thấy gián tiếp qua điểm case 0.33, chưa xem từng grader.

**Việc cho sau này:** sandbox eval phải chạy được `git` thì mới đo scope creep được. Nên thêm một smoke case chỉ chạy `git --version` và `git diff`, để một môi trường hỏng tự báo lỗi trước khi suite tốn 6 USD.
