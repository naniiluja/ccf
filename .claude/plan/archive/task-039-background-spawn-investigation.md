# Task 039 — Task điều tra: phân biệt "agent đang chạy nền" với "agent đã xong"

- **Slice:** task điều tra, không hứa trước là sẽ viết được mã, không chạm file spec nào.
- **Depends on:** 038
- **Implemented by:** **VÒNG CHÍNH**, KHÔNG phải `ccf-implementer`. Lý do bắt buộc: cả 6 agent CCF đều có `disallowedTools: Agent, Task` và đều là agent lá theo luật của lần làm 031, nên một `ccf-implementer` không thể gọi agent để lấy dữ liệu mẫu. Cùng loại với bài học `askuserquestion-not-in-subagents`: một năng lực không tồn tại trong agent con.
- **Model:** — (vòng chính)
- **Status:** in-review

## Goal (một câu)
Xác định bằng quan sát thật xem có phân biệt được "agent đang chạy nền" với "agent đã trả kết quả" hay không, để biết có nên viết hàm kiểm tra "review đã xong" hay không.

## Vì sao phải điều tra thay vì viết luôn
`hasSpecCheckerSpawn` chỉ chứng minh đã GỌI agent. Từ v2.1.198 agent chạy nền theo mặc định, nên `plan-review-gate` có thể cho `ExitPlanMode` đi qua khi bản review còn đang chạy. Nhưng đã đo trước: **6 lệnh `Bash` chạy nền có `tool_result` xác nhận NGAY**. Nếu spawn agent cũng vậy thì một phép kiểm "có kết quả nghĩa là đã xong" sẽ SAI. Vì con số đó, việc bịt lỗ hổng bị hạ xuống thành task điều tra.

## Đợt một: quét đọc-only 106 transcript của máy

| Chỉ số | Giá trị |
|---|---|
| Dòng transcript đã quét | 17.533 |
| Tổng `tool_use` | 3.204 |
| Tổng lần spawn agent | 42 |
| `run_in_background: false` | 39 |
| Field vắng mặt | 3 (đều là agent ngoài CCF) |
| `run_in_background: true` | **0** |

`subagent_type` quan sát được: `ccf:ccf-implementer` 25 lần, `ccf:ccf-spec-checker` 9, `ccf:ccf-best-practice-researcher` 5, `general-purpose` 2, `claude-code-guide` 1. Agent CCF dùng tên **CÓ tiền tố** `ccf:` là **39 trên 39**, dạng không tiền tố **0** lần.

## Đợt hai: gọi một agent chạy nền THẬT

| Lần spawn | `run_in_background` | Hình dạng `tool_result` |
|---|---|---|
| `ccf:ccf-best-practice-researcher` | false | `len=15238`, báo cáo grounding thật |
| `ccf:ccf-spec-checker` | false | `len=17895`, kết quả review thật |
| `ccf:ccf-implementer` ×3 | false | `len` 4463 tới 6056, báo cáo thật |
| `Explore` | **true** | `len=1072`, mở đầu `Async agent launched successfully.` |

## KẾT LUẬN: nhánh MỘT, phân biệt được

1. Agent chạy nền trả **ack TỨC THÌ**, có hình dạng đặc trưng, mở đầu bằng `Async agent launched successfully.` và kèm câu `The agent is working in the background`. Giống hệt cách lệnh `Bash` chạy nền trả `Command running in background with ID`.
2. **Kết quả cuối của agent nền KHÔNG về qua `tool_result`.** Chỗ đó vĩnh viễn là ack; kết quả thật về qua một bản ghi thông báo riêng.
3. **`is_error` KHÔNG dùng được làm dấu hiệu:** nó là `undefined` ở cả 6 ca, kể cả ca nền. Kế hoạch từng dự tính lọc theo `is_error`; **dự tính đó SAI**, phải bỏ.
4. Loại bản ghi trong transcript: `assistant=209`, `attachment=148`, `user=125`, `system:stop_hook_summary=8`, `system:compact_boundary=2` (khớp cơ chế của task 024), `file-history-snapshot=8`.

## Hệ quả: mở task 042 ở lần làm sau
Hàm kiểm tra "review đã XONG" LÀ viết được: khớp `tool_use_id` rồi **LOẠI những `tool_result` mang mẫu ack**. Còn lại là đã xong.

**Giới hạn phải ghi thật, không được che:** mẫu ack là chuỗi do harness sinh, KHÔNG có tài liệu, nên predicate phải HẸP đúng bài học Bug #4, và nếu transcript không có `tool_result` nào thì phải CHO QUA để không bao giờ treo phiên. Lần quan sát này dùng agent `Explore`, chưa phải agent CCF chạy nền. Chưa xác định chính xác kết quả cuối nằm ở loại bản ghi nào (`attachment` là ứng viên nhưng chưa chứng minh).

## Phần vẫn còn thiếu: `agent_type` thật của payload `SubagentStart`
CHƯA chụp được. Muốn chụp phải cho hook ghi log, mà plugin chạy từ bản cache chứ không phải bản trong repo, nên phải nạp lại plugin trước ([[ccf-plugin-runs-from-cache-not-repo]]).

Nghi vấn vẫn đứng nguyên: `shouldInject` từng so khớp TUYỆT ĐỐI với `ccf-implementer` trong khi tên quan sát được luôn là `ccf:ccf-implementer`. Nếu payload hook cũng mang tiền tố thì `agent-rules-inject` chưa từng chạy lần nào. **Đã vá phòng ngừa** trong lượt sửa review (so khớp phần sau dấu hai chấm), nhưng việc chụp payload thật vẫn cần làm để xác nhận.

**Không được kết luận vượt bằng chứng:** `subagent_type` ở phía lệnh gọi và `agent_type` trong payload hook là hai chỗ khác nhau, harness có thể chuẩn hoá.

## Cửa kiểm
Task điều tra không có cửa kiểm kiểu chạy test, và đó chính là lý do nó là task điều tra. Cửa kiểm là: có dữ liệu mẫu, có kết luận, đã chọn nhánh. Cả ba đã đủ.
