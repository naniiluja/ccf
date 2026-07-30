# Task 037 — Sửa con số độ sâu spawn agent con, và ghi rõ phải chờ agent chạy xong

- **Slice:** toàn bộ là văn bản hướng dẫn, không có mã chạy.
- **Depends on:** 036
- **Implemented by:** `ccf-implementer`, kèm `run_in_background: false`.
- **Model:** sonnet
- **Status:** in-review

## Goal (một câu)
Spec ngừng nói sai con số độ sâu spawn agent con, và luật làm tuần tự của CCF được cột lại ở phía lệnh gọi bằng `run_in_background: false`.

## Sự thật mới, đã ground qua changelog
Độ sâu spawn agent con là **VERSION-DEPENDENT**, không cố định: mặc định **3** tầng; là 5 ở v2.1.172 tới v2.1.216; là 1 ở v2.1.217 và v2.1.218; đổi được bằng `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH`. Đặt bằng 1 chỉ tắt spawn **LỒNG NHAU**, KHÔNG tắt subagent (harness vẫn spawn agent tầng 1 bình thường). Vậy spec cũ sai cả con số lẫn chữ "fixed".

Từ v2.1.198 subagent chạy **nền theo mặc định**. Không có lever frontmatter nào ép chạy đồng bộ: `background: true` chỉ ép VÀO nền, còn giá trị `false` không được tài liệu hoá. Nên lever duy nhất là ghi rõ ở phía LỆNH GỌI.

## Đã làm

**Sáu chỗ nói sai con số**, mỗi chỗ viết một kiểu. Bốn chỗ sửa trong phiên implement: `README.md:61`, `README.vi.md:61`, `README.zh-CN.md:61`, `CLAUDE.md:38`. Hai chỗ `.claude/rules/architecture.md:30` và `components.md:18` lúc đó bị chặn quyền ghi, được sửa sau khi người dùng mở quyền.

Chỗ `CLAUDE.md:38` là **chỗ bẫy**: nguyên văn có chữ "of" ở giữa (`up to a fixed depth of 5`) nên mọi mẫu tìm kiếm thông thường đều trượt nó, mà đó lại là spec nạp mỗi phiên.

**Ràng buộc khi viết, đã tuân thủ:** viết dạng "5 in v2.1.172 through v2.1.216", tức TÁCH con số ra khỏi chữ depth. Nếu viết liền thì mẫu tìm kiếm ở cửa kiểm sẽ khớp và báo đỏ oan.

**Ba chỗ TUYỆT ĐỐI không sửa** vì nói về độ sâu `@import`, khác nghĩa hoàn toàn: `CLAUDE.md:26`, `commands/init.md:39`, `agents/ccf-spec-writer.md:26`.

**`run_in_background: false`** thêm vào **12** chỗ gọi agent trong 6 lệnh: `cook.md` 3 chỗ, `check.md` 1, `fix.md` 1, `init.md` 4, `plan.md` 2, `updatespec.md` 1. Ghi kèm lý do ở `cook.md`. Riêng 5 agent phân tích chạy song song trong `init.md` cũng phải có, vì chạy song song vẫn phải chờ hết mới tổng hợp.

Vòng review bắt được **hai chỗ bỏ sót** trong `init.md` mà phiên implement đã trượt, đã thêm.

## Cửa kiểm, kết quả thật
- Mẫu tìm con số độ sâu: **9 kết quả trước sửa → 5 sau khi sửa 4 chỗ ghi được → 4 sau khi mở quyền và sửa 2 chỗ rule** (còn lại là 3 chỗ nói về `@import` cộng 1 chỗ `CLAUDE.md:38` đang TRÍCH DẪN chuỗi sai để ghi nợ).
- `grep run_in_background plugins/ccf/commands/*.md` ra đúng 12 chỗ.
- Đếm từ khoá luật (`right-size`, `vertical`, `STRICTLY SEQUENTIAL`, `refactor`): **107 → 107**, không giảm.
- `tsc --noEmit` exit 0; `node --test` 163 pass 0 fail (baseline lúc đó); `validate` passed.

## Nợ / bài học
`run_in_background: false` hiện chỉ là lời nhắc bằng **prompt**, tức model có thể bỏ qua. Vòng `/simplify` chỉ ra tầng đúng theo `architecture.md` là một hook `PreToolUse` matcher `Task` tự đặt `updatedInput.run_in_background = false`, thay cho 12 lời nhắc. Đã CỐ Ý hoãn (thiết kế mới, một task riêng). Đo thật: **0 trên 42** lần spawn trên máy này từng dùng `run_in_background: true` trước khi task 039 chủ động thử, nên nguy cơ là tiềm ẩn chứ chưa cháy.
