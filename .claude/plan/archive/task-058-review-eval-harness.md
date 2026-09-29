# Task 058 — Eval harness cho `/ccf:check` + đo baseline

- **Vertical slice:** eval suite (`plugins/ccf/evals/`) + fixture scaffold + grader + spec công cụ (`tooling.md`, `testing.md`)
- **Depends on:** — (task đầu iteration)
- **Spec refs:** `.claude/rules/testing.md` (bài học "latch chưa từng RED thì chưa chứng minh được gì"), `.claude/rules/tooling.md`, changelog 2.1.269 (`claude plugin eval`) và 2.1.283 (cần git 2.31 trở lên)
- **MCP to use:** none
- **Gate (must be GREEN before the next slice):** smoke case chạy thật và trả lời 4 unknown; mỗi grader lỗi-gài được thấy RED ít nhất một lần; baseline ghi vào file này; đo lại `wc -c` và chạy `node --test .claude/tests/*.test.mjs`

## Goal (one sentence)
Biến việc kiểm `/ccf:check` từ thủ công thành phép đo lặp lại được: 6 fixture có lỗi gài sẵn (5 lỗi, 1 sạch), chấm bằng `claude plugin eval`.

## Acceptance criteria (verifiable)
- [x] `plugins/ccf/evals/` có 6 case. Mỗi case gồm `prompt.md` gọi `/ccf:check`, `scaffold.sh` dựng repo git fixture (commit gốc trên `main`, thay đổi gài lỗi commit trên branch riêng) và `graders/`.
- [x] Case 1 thiếu tiêu chí chấp nhận; case 2 lỗi biên `<=`/`<` ở giới hạn spec nêu rõ; case 3 scope creep (sửa file ngoài task); case 4 vi phạm rule quote được; case 5 catch nuốt lỗi; case 6 diff sạch.
- [x] Grader case 1 đến 5 bắt `FAIL:` kèm đường dẫn của lỗi gài; mọi case có grader `tool_used` cho spawn `ccf-spec-checker`; case 6 kiểm không có `FAIL:`, cách viết tra docs `plugin-evals` trước.
- [x] Smoke case ghi kết quả thật cho 4 unknown: cwd sandbox có phải thư mục scaffold; `CLAUDE.md` của fixture có tự load; `/ccf:check` trong `prompt.md` có chạy như slash command; grader có thấy spawn của subagent.
- [x] Ít nhất một grader được thấy RED (sửa tạm để lỗi biến mất thì case rớt).
- [x] Baseline 3 runs mỗi case: recall trên case 1 đến 5, false positive trên case 6, chi phí, ghi ở mục Results bên dưới.
- [x] `plugins/ccf/evals/results/` nằm trong `.gitignore`; `tooling.md` có mục `claude plugin eval` (khi nào dùng, gọi thế nào, git 2.31, chi phí); `testing.md` có suite đo lường thứ tư, không chạy theo từng commit.

## Test first (write before implementing)
Smoke case với một fixture tối thiểu, chạy `claude plugin eval plugins/ccf --case <smoke> --scaffold --ablation none --allow-tools Bash --runs 1 --no-publish`, trước khi viết 6 case.

## Files to touch
- `plugins/ccf/evals/<case>/{prompt.md,scaffold.sh,graders/*.md}` — mới
- `.gitignore` — thêm `plugins/ccf/evals/results/`
- `.claude/rules/tooling.md`, `.claude/rules/testing.md` — mục mới, đo lại ccf-budget

## Notes / best-practice sources
- `claude plugin eval --help` (2.1.284): `--scaffold`, `--ablation none`, `--max-cost-usd`, `--json`, `--threshold`, grader `regex`/`tool_used`/`llm`.
- Cặp diff sạch/hỏng theo Qodo benchmark; đo precision/recall theo Martian Code Review Bench.

## Results
**Smoke lần 1 (2026-09-29, case `04-rule-violation`, 1 run, chi phí 0 USD vì run bị từ chối trước khi chạy):**
- Unknown 1 (cwd): quan sát được. `scaffold_script` chạy với cwd = `/tmp/claude-eval-XXXX/home/cwd`, không nhận argument, `HOME` là thư mục tạm. Scaffold dựng repo ngay trong cwd là đúng chỗ.
- Unknown 2, 3, 4 (CLAUDE.md của fixture có load không, `/ccf:check` có chạy như slash command không, grader có thấy spawn `Task` không): chưa quan sát, run bị chặn.
- **Blocker:** cấp `Bash` cho eval bị từ chối vì máy chưa có sandbox backend: `bubblewrap (bwrap) not installed` (`sandbox.failIfUnavailable`). `/ccf:check` cần `Bash` để chạy `git diff` và test, nên không bỏ được. Cần `apt install bubblewrap socat`.
- Định dạng thật của case: `case.yaml` (`schema_version: "1.1"`, `name`, `context.scaffold_script`), `prompt.md`, `graders/*.md`; kết quả JSON nằm ở `cases[].arms.with[]` (`score`, `turns`, `costUsd`, `error`, `graders[]`).
- Cảnh báo: 2 MCP đi kèm plugin (context7, microsoft-learn) không có mock nên không khởi động trong eval; `/ccf:check` không cần chúng.

**Smoke lần 2 đến 4 (2026-09-29, `bubblewrap` 0.9.0 có sẵn):**
- Lần 2: `401 API key is invalid`. Eval con dùng `ANTHROPIC_API_KEY` trong môi trường (key hỏng), trong khi phiên này đăng nhập bằng oauth. Chạy với `env -u ANTHROPIC_API_KEY` thì qua. **Mọi lệnh eval phải có tiền tố đó trên máy này.**
- Lần 3: grader `regex` sai cú pháp. Nội dung body của file grader chính là pattern (không có khóa `pattern:`), ban đầu tôi viết `pattern: '...'` nên regex tìm nhầm chữ "pattern:". Đã sửa.
- Lần 4 (chạy được): 49 giây, 10 lượt ở phiên cha, **0.25 USD một run**. Ước tính 18 run là 4.5 USD; đề xuất `--max-cost-usd 8`.
- Unknown 3 quan sát được: `/ccf:check` chạy như slash command trong `claude -p`; nó tự tải các file spec, gọi `Agent` với `subagent_type` là `ccf:ccf-spec-checker` và `run_in_background: false`.
- Unknown 4 quan sát được: tên tool spawn trong trace là `Agent`, không phải `Task`, và `subagent_type` có tiền tố plugin. Grader `tool_used` phải dùng `tool: Agent` và `input_match: ccf-spec-checker` (đã sửa; chưa chạy lại).
- Unknown 2 chưa kết luận: trace cho thấy `/ccf:check` tự `Read` CLAUDE.md, không chứng minh CLAUDE.md được nạp tự động. Không ảnh hưởng gate vì check.md bước 1 đã tự đọc.
- Grader `found-violation` PASS (matched `FAIL:...src/greet.js`): checker phát hiện đúng lỗi `console.log`, kèm ghi nhận thiếu test cho tiêu chí chấp nhận.
- **Blocker thứ hai (môi trường):** trong eval, mọi lệnh `Bash` đều lỗi `bwrap: loopback: Failed RTM_NEWADDR: Operation not permitted` (bubblewrap chạy lồng trong một container/sandbox khác không cho tạo loopback). Hệ quả: checker không chạy được `git diff main...HEAD` (check.md bước 4) hay test, chỉ đọc file tại HEAD. Đo recall lúc này chỉ phản ánh chế độ suy giảm "không có diff", chưa phản ánh `/ccf:check` đầy đủ. Case 3 (scope creep) cần diff nên không đo hợp lệ được.

**6 case đã viết (2026-09-29), fixture kiểm bằng cách dựng thử từng scaffold ngoài eval:** mỗi case dùng cùng một repo gốc (2 rule quote được `logging.md` và `error-handling.md`, task 001 có 4 tiêu chí, `package.json` kiểu module) rồi commit thay đổi lên `feature/greet`. `node --test` của fixture: 01 (thiếu throw tên rỗng) 3 pass 1 fail; 02 (`>=` thay `>` ở giới hạn 20) 3 pass 1 fail; 03 (scope creep, sửa `src/logger.js`) 4 pass; 04 (`console.log`) 4 pass; 05 (catch rỗng nuốt lỗi) 2 pass 2 fail; 06 (sạch) 4 pass. Lưu ý: ở 01, 02, 05 test của fixture tự đỏ, nên checker có thể phát hiện qua test chứ không chỉ qua đọc diff.
- Case 06 dùng regex phủ định `^(?![\s\S]*\n\s*[-*]\s*FAIL:)[\s\S]+$` (không có dòng `- FAIL:` nào). Chưa chạy: cần thấy nó xanh trên diff sạch và đỏ khi có FAIL.
- **Việc tiếp theo cần chạy ngoài container** (theo lựa chọn của người dùng, vì bubblewrap lồng không tạo được loopback):
  `cd plugins/ccf && env -u ANTHROPIC_API_KEY claude plugin eval . --scaffold --ablation none --allow-tools Bash --runs 3 --max-cost-usd 8 --no-publish --trust-plugin --json /tmp/baseline.json`
  Ước tính 18 run x 0.25 USD = 4.5 USD, trần 8 USD.
- **Chưa quan sát:** baseline recall và false positive đầy đủ (có Bash), grader RED có chủ đích, `--max-cost-usd` thực sự dừng run.

**Baseline chính thức (2026-09-29, chạy ngoài container trước khi thay máy, Claude Code 2.1.284, plugin 0.10.0):** nguồn là `plugins/ccf/evals/results/2026-09-29T12-34-10-220Z/aggregate-result.json` (git-ignore; `/tmp/baseline.json` và mọi `trace.jsonl` đã mất theo `/tmp`). Số liệu dưới đây đọc lại trực tiếp từ file đó.
- 6 case x 3 runs = 18 run, 1392 giây, **5.999 USD** (trung bình 0.333 USD/run, 13 đến 15 lượt/run), `partial: false`, `casesPassed` 5/6, `overallScore` 0.972, `overallPassRate` 0.944.
- **Recall trên case 01 đến 05: 14/15 (93.3%).** Lần trượt duy nhất: `03-scope-creep` run 3 (score 0.5, `found-defect` RED "pattern not found", checker vẫn được spawn). Scope creep là lỗi chỉ thấy qua diff, không có test đỏ đi kèm, nên đây là điểm yếu cần theo dõi ở 059.
- **False positive trên case 06: 0/3.**
- `spawned-checker` xanh 18/18 (`Agent` gọi đúng 1 lần mỗi run).
- 2 MCP đi kèm (microsoft-learn, context7) không có mock nên không khởi động trong mọi run; `/ccf:check` không dùng chúng.

**Đóng theo lệnh người dùng (2026-09-29), các phần gate CHƯA QUAN SÁT được chấp nhận để lại:**
- Grader RED có chủ đích (sửa lỗi gài rồi thấy case rớt) chưa làm. Chỉ có một RED tự nhiên: `found-defect` của 03 run 3. Regex phủ định của case 06 chưa từng được thấy RED; nó chỉ bắt dòng dạng `- FAIL:`/`* FAIL:`, nên một `FAIL:` viết kiểu khác sẽ lọt.
- Không xác nhận lại được `Bash` có chạy trong 18 run baseline (trace đã mất). Số lượt tăng từ 10 (smoke, Bash hỏng) lên 13 đến 15 là dấu hiệu gián tiếp, không phải bằng chứng.
- `--max-cost-usd` thực sự dừng run: chưa quan sát.
- Máy mới không có `bwrap`, nên eval có `Bash` không chạy được trong container này; mọi lần đo lại (gate của 059) phải chạy trên host.
- Đo lại ccf-budget sau khi thêm mục eval vào `tooling.md` và `testing.md`: paid = 94990 byte, `node --test .claude/tests/*.test.mjs` 10 pass, 0 fail.
