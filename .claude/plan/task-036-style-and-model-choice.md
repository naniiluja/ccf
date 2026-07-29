# Task 036 — Quy tắc văn phong cho văn bản CCF sinh ra, và hỏi người dùng chọn model

- **Slice:** một slice cố kết, cùng sửa văn bản hướng dẫn, cùng chạm `commands/plan.md`, cùng mục tiêu là người dùng duyệt kế hoạch dễ hơn và kiểm soát nhiều hơn.
- **Depends on:** — (task mở đầu iteration `cc-2.1.220-realign`)
- **Implemented by:** `ccf-implementer`, kèm `run_in_background: false`.
- **Model:** sonnet
- **Status:** in-review

## Goal (một câu)
Ép mọi văn bản CCF sinh ra phải dễ đọc đúng một ngôn ngữ, và trả quyền chọn model về cho người dùng thay vì đóng cứng trong prompt.

## Vì sao
Cả hai phần đều do người dùng yêu cầu trực tiếp trong lúc duyệt kế hoạch. Phần A: văn bản CCF sinh ra dùng dấu gạch dài liên tục, trộn tiếng Anh vào câu tiếng Việt, câu dài nhiều tầng, làm cả người duyệt và model đọc lại đều dễ nhầm. Phần B: `cook.md` đóng cứng model `sonnet`, frontmatter 6 agent cũng đóng cứng, nên người dùng không được chọn dù chính họ trả tiền và chỉ họ biết task khó tới đâu.

## Đã làm

**Phần A, quy tắc 7 điểm** vào `commands/plan.md` (mục `0a`), `commands/init.md`, `commands/updatespec.md`, `agents/ccf-spec-writer.md`, và mục Language của `.claude/rules/coding-conventions.md`:
1. Viết bằng đúng ngôn ngữ người dùng đang dùng, không trộn hai ngôn ngữ trong một câu.
2. Giữ nguyên dạng gốc CHỈ với tên file, hàm, biến, lệnh, field, sự kiện (đây là định danh).
3. Mọi khái niệm còn lại phải dịch (gate là cửa kiểm, spike là task điều tra, toggle là công tắc, …).
4. Không dùng em-dash.
5. Một câu một ý.
6. Ngôn ngữ có dấu phải đủ dấu.
7. Không viết tắt tự phát.

Ghi rõ **ranh giới phạm vi**: quy tắc chi phối văn bản CCF SINH RA cho người đọc, KHÔNG chi phối source của repo CCF (vẫn tiếng Anh theo `components.md`).

**Phần B, chọn model:** `skills/grill-me/SKILL.md` hỏi MỘT lần về mức mặc định của cả kế hoạch ở bước 2 (gợi ý `sonnet` cho task rõ ràng, `opus` cho task khó, `haiku` cho sửa văn bản); `commands/plan.md` bước 5 ghi dòng `Model:` vào từng file task và cho ghi đè theo task; `commands/cook.md` bỏ câu đóng cứng, đọc dòng `Model` từ file task, thiếu thì hỏi người dùng một lần cho cả lượt; `commands/fix.md` và `init.md` cùng cách; `.claude/rules/components.md` ghi rõ frontmatter `model`/`effort` chỉ là MẶC ĐỊNH và lựa chọn của người dùng THẮNG.

**Định dạng dòng `Model:` đã chốt:** alias THUẦN (`sonnet`/`opus`/`haiku`), không mã model có ngày tháng, không chữ trong ngoặc trên chính dòng đó, vì `cook.md` phải bóc tách đúng dòng này.

**Ở chế độ không-hỏi** thì dùng mặc định của frontmatter và NÓI RA đã dùng mặc định nào, tuyệt đối không im lặng làm như đã hỏi. Chính phiên thi hành task này đã phải dùng đúng nhánh đó.

## Cửa kiểm, kết quả thật
- Quy tắc có mặt ở cả 5 file phần A, bốn bản khớp nhau từng ký tự (chỉ dòng "Scope boundary" khác theo ngữ cảnh, đúng chủ ý).
- `cook.md` không còn đóng cứng model, có nhánh đọc dòng `Model` và nhánh hỏi người dùng.
- `grill-me/SKILL.md` có câu hỏi model và có nhánh xử lý khi không hỏi được.
- `tsc --noEmit` exit 0; `claude plugin validate` passed; bộ test giữ nguyên nền, 0 fail.

## Nợ / bài học
Khối 7 điểm hiện bị SAO Y bốn bản. Vòng `/simplify` xác định tầng đúng của nó là một file trong `.claude/rules/`, nhưng việc gộp bị CỐ Ý hoãn (thiết kế mới). Bốn bản đã được đồng bộ nội dung để không lệch tiếp — bản trong `ccf-spec-writer.md` từng lệch ngay lúc sinh ("the caller is using" thay vì "the user is using"), đã sửa.
