# Task 040 — Sửa lời nhắc compact cho khớp ngữ cảnh và đúng ngôn ngữ

- **Slice:** 1 lib + 1 hook + 1 test + 1 rule.
- **Depends on:** 039
- **Implemented by:** `ccf-implementer`, kèm `run_in_background: false`.
- **Model:** sonnet
- **Status:** in-review (cửa kiểm quan sát thật CHƯA làm)

## Goal (một câu)
Hook thôi giành việc soạn câu `/compact`: nó lo phát hiện vượt ngưỡng và cấp dữ liệu, còn model lo diễn đạt bằng ngôn ngữ người dùng dựa trên việc thật đã làm trong phiên.

## Vấn đề (người dùng chỉ ra trực tiếp)
Câu cũ hook gợi ý:
```
/compact Focus on the current task and key decisions; preserve modified files and test commands; drop old tool output.
```
Ba chỗ sai cùng lúc:
1. **Nói sai việc đang làm.** Bảo giữ "các file đã sửa và lệnh test", nhưng phiên đang lập kế hoạch thì chưa sửa file nào. Nó khuyên giữ thứ không tồn tại.
2. **Sai ngôn ngữ.** Câu cố định bằng tiếng Anh trong khi người dùng làm việc bằng tiếng Việt. Chính hook của CCF vi phạm quy tắc văn phong mà task 036 vừa đặt ra.
3. **Sai chỗ đặt trách nhiệm, đây là LỖI GỐC.** `buildCompactHint` cố tự soạn câu lệnh, nhưng hook chỉ đọc được bản ghi hội thoại và `PLAN.md` nên KHÔNG biết phiên này thực sự đang làm gì. Khi `PLAN.md` không có task nào đang chạy thì nó rơi về câu mẫu chung chung vô nghĩa.

## Nguyên tắc để sửa
Theo `.claude/rules/architecture.md`, mục "Deterministic part vs prompt part": việc cần CHẮC CHẮN thì giao hook, việc cần PHÁN ĐOÁN thì giao prompt. Phát hiện vượt ngưỡng là việc chắc chắn, hook làm đúng và GIỮ NGUYÊN. Soạn câu compact khớp ngữ cảnh là phán đoán, chỉ model biết phiên này đã làm gì và người dùng đang viết ngôn ngữ nào.

## Đã làm
- `lib/context-usage.mjs`: `buildCompactHint` đổi tên thành **`normalizeHintTask`**, bỏ tham số `pct` (là mã chết: `context-guard.mjs` tự tính `pct` rồi, `hint.pct` chỉ có test đọc), trả trực tiếp `{id, title}` hoặc `null` (bỏ lớp bọc `{task:...}` dư). Không có task thì trả `null`, tuyệt đối không bịa câu mẫu.
- `context-guard.mjs`, `systemMessage`: câu ngắn trung tính chỉ nêu con số và khuyến nghị compact, KHÔNG kèm câu lệnh mẫu.
- `context-guard.mjs`, `additionalContext`: CHỈ THỊ cho model tự soạn câu `/compact` bằng ngôn ngữ người dùng, dựa trên việc THẬT đã làm; nói rõ không dùng câu mẫu, không khuyên giữ thứ chưa tồn tại. Hai đoạn từng lệch nhau (nhánh chặn viết "canned template", nhánh cảnh báo viết "fixed template") đã hợp nhất thành một hằng dùng chung.
- Bỏ nhãn **"in-progress"** gắn cứng: `findHintTask` có nhánh dự phòng trả task `todo`, nên nhãn cũ khẳng định sai với cả người dùng và model. Đây là hồi quy do chính task này tạo, vòng review bắt được.
- `.claude/rules/hooks.md`: thêm mục "chia việc phát hiện với diễn đạt" kèm lý do.

**Phần GIỮ NGUYÊN, không được đụng:** `shouldNudgeCompact`, `readContextUsage`, `isCompactBoundary`, `decideGuardAction`.

**Lợi ích kèm theo:** cách này giải quyết luôn vấn đề ngôn ngữ mà hook KHÔNG cần biết người dùng dùng tiếng gì, vì model trả lời bằng ngôn ngữ của người dùng là chuyện đương nhiên.

## Test viết TRƯỚC, đã quan sát đỏ rồi mới xanh
Chạy bộ test CŨ trên hàm MỚI → **3 ca đỏ** (`AssertionError: The "string" argument must be of type string. Received type object`), chứng minh test cũ đang khẳng định hợp đồng chuỗi đã bị bỏ. Rồi viết lại 3 ca thành 5, gồm **ca chống tái phạm** khẳng định giá trị trả về KHÔNG chứa `Focus on the current task`, `preserve modified files`, `drop old tool output`, và cả chuỗi `/compact`. Lần sau ai nhét lại câu mẫu thì test đỏ ngay.

## Cửa kiểm, kết quả thật
- `node --test`: **165 → 167 pass, 0 fail**.
- `tsc --noEmit` exit 0.
- Smoke `context-guard` 2 ca: dưới ngưỡng (50k/1M) → im lặng exit 0; trên ngưỡng (500001/1M) → in CẢ `systemMessage` (`"CCF: context ~50% (500001 tokens) …"`) và `additionalContext` (chỉ thị cho model), không còn câu tiếng Anh đóng cứng.
- `grep "Focus on the current task" plugins/ccf/hooks/` chỉ còn 1 kết quả, và đó chính là chuỗi trong test chống tái phạm.

## CỬA KIỂM CHƯA LÀM — không được coi là xong
Quan sát thật sau khi nạp lại plugin: đẩy context vượt ngưỡng rồi xem lời nhắc hiện ra có đúng tiếng Việt và có nêu đúng việc phiên đang làm hay không. Việc này do NGƯỜI DÙNG làm. **CHƯA quan sát.** Ghi chú: chính phiên thi hành iteration này vẫn nhận được lời nhắc bằng câu tiếng Anh cũ, vì plugin chạy từ bản cache chứ không phải bản trong repo ([[ccf-plugin-runs-from-cache-not-repo]]) — đó là bằng chứng gián tiếp rằng bản sửa chưa có hiệu lực, không phải bằng chứng bản sửa sai.
