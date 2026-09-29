# Task 063 — Checker scope thứ hai chạy song song trong `/ccf:check`

- **Loại:** prompt (agent + command) cộng eval fixture. Không có code hook.
- **Spec refs:** `.claude/rules/architecture.md` (Command ↔ agent boundary: mọi agent read-only, fan-out song song cho review được phép), `.claude/rules/components.md` (chọn `model`/`effort`, `disallowedTools`, `maxTurns`), `.claude/rules/prompt-standard.md` (khối văn phong md5, marker, heading).
- **Quyết định đã duyệt:** checker thứ hai có phạm vi riêng, model Sonnet effort medium, chạy song song với `ccf-spec-checker`; gộp finding theo `file:line`; hiểu `PARTIAL:`; Jev chú thích trên báo cáo đã gộp; KHÔNG dùng tính năng agent teams chính thức (hai lần spawn Task bình thường trong một message); thêm fixture phân biệt hai checker.

## Thiết kế
- Agent mới `ccf-scope-checker` (read-only, leaf): chỉ xét phạm vi của diff so với task, tức mỗi file đổi có thuộc `Files to touch` hoặc được một tiêu chí yêu cầu không, tiêu chí nào không có thay đổi tương ứng, và thay đổi nào không tiêu chí nào đòi. Không xét convention, SOLID, error handling: đó là việc của `ccf-spec-checker`, nên hai phạm vi không chồng nhau.
- Sonnet + `effort: medium`: đối chiếu diff với danh sách file và tiêu chí là việc đã được giới hạn rõ, đúng mức mà `components.md` gán cho Sonnet. `maxTurns: 25` là ước lượng, chưa có trace.
- Cùng rubric điểm, cùng quy tắc quote, cùng heading với `ccf-spec-checker`, nên `check.md` gộp được mà không đổi parser nào.
- Gộp trong `check.md` bước 6: khóa là `file:line` đã chuẩn hóa; trùng khóa thì giữ một dòng, lấy marker nặng hơn (`FAIL:` > `WARN:`), ghi nguồn `(spec+scope)`; không bao giờ bỏ một finding; finding không có `file:line` giữ nguyên, không gộp.

## Files to touch
- `plugins/ccf/agents/ccf-scope-checker.md` (new)
- `plugins/ccf/commands/check.md`
- `plugins/ccf/evals/07-scope-only/` (new: `case.yaml`, `prompt.md`, `scaffold.sh`, `graders/*.md`)
- `.claude/rules/components.md`, `.claude/rules/architecture.md`, `.claude/rules/prompt-standard.md`, `CLAUDE.md`
- `README.md`, `README.vi.md`, `README.zh-CN.md`, `plugins/ccf/README.md`

## Acceptance criteria
- [ ] `ccf-scope-checker.md` tồn tại với `model: sonnet`, `effort: medium`, `maxTurns`, `disallowedTools: Write, Edit, NotebookEdit, Agent, Task`; body nói rõ read-only, leaf, và phạm vi chỉ gồm scope.
- [ ] Agent mới mang khối văn phong đúng md5 `deac0ef73d3c0cb9d26766027a906385`, và danh sách bản sao trong `prompt-standard.md` lên 8.
- [ ] `check.md` bước 3 spawn cả hai checker trong một message, mỗi cái `run_in_background: false`, không dùng agent teams.
- [ ] `check.md` áp luật `PARTIAL:` cho từng checker riêng; một checker còn partial sau một lần tiếp tục thì cả báo cáo gộp mở bằng `PARTIAL:`.
- [ ] `check.md` bước 6 gộp theo `file:line`, giữ marker nặng hơn, ghi nguồn, không bỏ finding nào; bước 6b chạy Jev trên báo cáo đã gộp.
- [ ] Eval `07-scope-only`: diff chỉ có lỗi scope (một file ngoài `Files to touch`, sạch về mọi rule), grader đòi `FAIL:` trên file đó và một lần spawn `ccf-scope-checker`.
- [ ] Số agent 4 sang 5 đồng bộ ở mọi nơi ghi số, và mọi câu "all 4 agents" còn đúng.
- [ ] Ba bộ test, `tsc`, `claude plugin validate`, quét codepoint, `ccf-budget` đều xanh.

## Results
- **Gate tĩnh, chạy thật:** `claude plugin validate plugins/ccf` passed; md5 cả 8 bản khối văn phong = `deac0ef73d3c0cb9d26766027a906385`; quét codepoint 0 hit; lib 247 pass; template 8 pass; `tsc` exit 0. `ccf-budget` được đo lại ở cuối session.
- **Chạy thử prompt, không phải eval:** một agent `general-purpose` model sonnet đọc nguyên văn `ccf-scope-checker.md` rồi review fixture 07 (dựng bằng `scaffold.sh` trong `/tmp/e07`). Kết quả: `FAIL: scope — README.md:1`, quote đúng dòng `Files to touch`, confidence 100; thêm một `WARN:` hợp lý (export `MAX_NAME_LENGTH` không tiêu chí nào đòi, confidence 60); đủ `### Declined to judge`. Vì chạy qua stand-in nên `maxTurns: 25` và `effort: medium` không được áp.
- **Chưa chạy:** `claude plugin eval` cho 7 case (tốn khoảng 6 USD, cần host có sandbox `bubblewrap`). Grader `attributed-to-scope` phụ thuộc vào bước gộp của `check.md` ghi nhãn `(scope)`, chưa quan sát. Bước gộp theo `file:line` và việc spawn hai checker song song trong một message cũng chưa quan sát trên plugin đã cài.
- **Mở:** 06-clean-diff phải vẫn không có `FAIL:` khi có checker thứ hai; chỉ eval mới trả lời được.
