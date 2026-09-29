# Task 065 — `slice-check` fail-closed (bước 1 của đề xuất 064)

- **Loại:** code (lib thuần + script) cộng doc.
- **Spec refs:** `task-064-worktree-parallel-research.md` mục 1, 2b, 9 bước 1; `.claude/rules/hooks.md` (lib thuần, không dependency, không throw); `.claude/rules/architecture.md` (script do người chạy).
- **Nguyên tắc đã duyệt:** đồ thị phụ thuộc tất định là nguồn chính; Jev chỉ được THÊM cạnh; Jev không trả lời thì coi là phụ thuộc (fail-closed về tuần tự).

## Thiết kế
- `extractFiles` giữ nguyên một nhóm ngoặc nhọn chứa khoảng trắng hoặc dấu phẩy (`{check updatespec}.md`, `{a,b}.md`) thành một token, rồi `expandBraces` bung nó ra. Ngoặc lệch thì giữ token gốc và đánh dấu không phân tích được.
- `pathsClash(a, b)`: hai đường dẫn cụ thể so bằng nhau sau chuẩn hóa; glob với đường dẫn cụ thể so bằng regex của glob (`**`, `*`, `?`); hai glob thì so tiền tố trước ký tự đại diện đầu tiên (một đường dẫn khớp cả hai phải bắt đầu bằng cả hai tiền tố, nên tiền tố này phải là tiền tố của tiền tố kia); thư mục kết thúc bằng `/` là `dir/**`. Không phân tích được thì luôn là trùng.
- Task không có `Files to touch` thì trùng với mọi task (cạnh `unknown-files`).
- Hotspot do code phát hiện bằng danh sách mẫu (lockfile và manifest dependency, migration/schema, file sinh và snapshot, index/barrel, config dùng chung, spec và doc chung). Hai task cùng chạm một lớp hotspot thì có cạnh `hotspot`.
- Cặp đã có cạnh tất định thì không hỏi Jev. Cặp còn lại hỏi 3 câu: `dep_`, `contract_`, và mới `shared_state_`.
- Ngưỡng cạnh do Jev là 0.3 (`EDGE_THRESHOLD`), thấp hơn 0.5 của fragment, vì báo nhầm "độc lập" đắt hơn nhiều so với báo nhầm "phụ thuộc".
- Thiếu câu trả lời, câu trả lời sai dạng, hoặc batch lỗi cho bất kỳ câu nào của một cặp thì cặp đó có cạnh `unanswered` và được liệt kê trong `unanswered`.
- Output thêm `unanswered` và `parallel_candidates` (các wave có từ 2 task, tức không có cạnh nào giữa chúng) kèm ghi chú rằng recall của Jev chưa được backtest (bước 2), nên đây chỉ là ứng viên, preflight (066) kiểm lại trên diff thật.

## Files to touch
- `plugins/ccf/hooks/lib/slice-check.mjs`, `plugins/ccf/hooks/lib/slice-check.test.mjs`, `plugins/ccf/hooks/lib/slice-check-script.test.mjs`
- `plugins/ccf/scripts/jev-slice-check.mjs`
- `.claude/rules/tooling.md`, `plugins/ccf/skills/plan/SKILL.md` (câu mô tả JSON)

## Acceptance criteria
- [ ] `extractFiles` bung `{a b}` và `{a,b}` thành các đường dẫn riêng; ngoặc lệch không throw và được coi là trùng với mọi task.
- [ ] Glob và thư mục trùng với đường dẫn cụ thể bên dưới chúng; hai glob có tiền tố rời nhau thì không trùng.
- [ ] Task không có file khai báo tạo cạnh `unknown-files` với mọi task khác.
- [ ] Hai task cùng một lớp hotspot có cạnh `hotspot`, không hỏi Jev.
- [ ] Mỗi cặp chưa được code quyết thì có đủ `dep_`, `contract_`, `shared_state_`.
- [ ] Thiếu hoặc sai dạng bất kỳ câu nào của một cặp (kể cả batch lỗi) tạo cạnh `unanswered`; `results = []` cho ra toàn tuần tự.
- [ ] Cạnh Jev tính ở ngưỡng 0.3; fragment vẫn 0.5.
- [ ] Chạy trên 5 task file 058-062 đã archive: 060 và 061 không còn chung wave.
- [ ] Test RED trước, rồi xanh; `tsc` exit 0; script vẫn luôn exit 0.

## Results
- **RED trước:** bộ test mới import `EDGE_THRESHOLD` chưa tồn tại nên đỏ toàn file; sau khi có lib, test ngoặc lệch đỏ thật (`[ 'src/{a', 'b.mjs' ]` thay vì một token) và test `note` của script đỏ (`undefined`). Cả ba xanh sau khi sửa.
- **Xanh:** `node --test plugins/ccf/hooks/lib/*.test.mjs` 256 pass, 0 fail (từ 247); `tsc` exit 0; `claude plugin validate` passed.
- **Chạy trên 5 task đã archive (058-062), không gọi Jev:** 10 cặp đều do code quyết (0 `unanswered`), 5 wave tuần tự. 060 và 061 giờ có cạnh `file-overlap` trên `plugins/ccf/commands/check.md`, đúng chỗ đề xuất 064 mục 1 chỉ ra là bị bỏ sót. 058 và 060 nối nhau bằng `hotspot` (`shared-spec`).
- **Một cạnh bảo thủ đã thấy:** 058 `plugins/ccf/evals/results/` và 059 `plugins/ccf/evals/*/graders/` bị coi là trùng, vì `*` có thể khớp `results`. Theo luật fail-closed thì đúng.
- **Chưa quan sát:** gọi Jev thật cho câu `shared_state_`. Egress proxy của VM làm request treo khoảng 20s (task 061), nên code path gọi Jev thật được giữ nguyên, chỉ test qua fake `node:http`.
- **Sau `/ccf:check`:** một `WARN:` đã tái hiện: ngoặc lệch có chữ theo sau trên cùng dòng (`src/{a b.mjs` — ghi chú) làm token bị bỏ, và cả đường dẫn hợp lệ sau nó cũng mất. `splitTokens` giờ cắt token tại khoảng trắng đầu tiên sau ngoặc rồi đọc tiếp phần còn lại. Có test RED rồi xanh.
- **Giữ nguyên có chủ đích:** không có key thì script vẫn thoát sớm với `no-key` như trước, vì skill `plan` chỉ gọi nó khi đã có key.
