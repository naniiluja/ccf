# Task 041 — Nhắc ở Stop qua hai kênh, lưới an toàn cho `io.mjs`, và ghi sổ đóng việc

- **Slice:** 3 lib + 1 lib mới + 1 file test mới + 1 hook + 4 file phiên bản + sổ sách.
- **Depends on:** 040
- **Implemented by:** `ccf-implementer`, kèm `run_in_background: false`.
- **Model:** sonnet
- **Status:** in-review (quan sát trọn gói CHƯA làm)

## Goal (một câu)
Mở kênh thứ hai cho lời nhắc ở Stop (đặt sau một công tắc mặc định TẮT), và dựng lưới an toàn ĐẦU TIÊN cho `io.mjs` sau khi 10 file test không file nào chạm tới nó.

## Bối cảnh
Từ v2.1.163 Stop CŨNG nhận `hookSpecificOutput.additionalContext` (task 038 đã sửa chú thích sai). Hiện `updatespec-nudge.mjs` dùng `emitSystemMessage`, tức chỉ nói được với NGƯỜI DÙNG, model KHÔNG nhận lời nhắc nào.

## Đã làm

**Một, `io.mjs#emitStopAdvisory(context, message)`** in `{hookSpecificOutput:{hookEventName:"Stop",additionalContext},systemMessage}`. Phần dựng payload dùng chung với `emitPromptWarning` được rút thành hàm module-private `buildDualChannelPayload`.

**PHẠM VI GOM MÃ ĐƯỢC KHAI GIỚI HẠN VÀ ĐÃ TUÂN THỦ:** chỉ hai hàm đó dùng hàm dùng chung. Sáu hàm còn lại (`emitContext`, `emitSystemMessage`, `blockStop`, `blockSubagentStop`, `blockUserPrompt`, `denyTool`) KHÔNG bị chạm thân hàm. Đây là gom mã tối thiểu đi kèm, không phải tái cấu trúc lớn núp trong tính năng.

**Hai, công tắc `--dual-channel-stop`** cho `updatespec-nudge.mjs`: có cờ thì `emitStopAdvisory`, không cờ thì `emitSystemMessage` như hiện nay (đường mặc định, phải BẤT BIẾN). Ba nhánh nhắc A, B, C giữ nguyên logic; hai mảng song song `directiveParts`/`userParts` được gộp thành MỘT mảng object `{directive, userNote}` để không thể lệch nhau. **KHÔNG thêm cờ vào `hooks.json`**, nghĩa là mặc định TẮT.

Vòng review bắt: ban đầu cả hai kênh nhận CÙNG một chuỗi, tức chỉ nhân đôi văn bản chứ chưa tạo giá trị, và người dùng nhìn thấy một câu lệnh viết cho model. Đã tách: `additionalContext` là chỉ thị, `systemMessage` là câu dữ kiện ngắn, đúng mẫu `context-guard.mjs`.

**Ba, `lib/io.test.mjs` mới**, chạy TỪNG HOOK thật qua `spawnSync(process.execPath, ...)` với thư mục tạm dựng riêng. Phủ đủ 8 hàm phát của `io.mjs` qua 9 hook. Không dùng cách chụp ảnh trước và sau, vì cách đó mong manh: hai ca đọc `PLAN.md` đang sống mà chính task này lại sửa `PLAN.md`, nên sẽ báo đỏ oan.

**Chống trường hợp xanh mà rỗng**, đây là đường thất bại nguy hiểm hơn cả báo đỏ oan: mỗi ca kiểm payload KHÁC RỖNG; hai ca dùng `blockUserPrompt` kiểm **stderr khác rỗng và mã thoát bằng 2** chứ không kiểm stdout (hàm này ghi stderr rồi thoát 2, không in JSON); có **phép thử phá logic** (phá hàm dùng chung thì các ca `emitPromptWarning` và `emitStopAdvisory` phải đỏ); ba transcript mẫu KHÁC nhau; ca `agent-rules-inject` mang chú thích **"ASSUMPTION FLAGGED AS UNVERIFIED"** ngay trong file; hai ca bắt buộc dùng thư mục tạm chứ không trỏ vào repo sống; chạy được trên Windows (`spawnSync` với `shell: false`, `os.tmpdir()`, `mkdtempSync`, `path.join`, không ống lệnh POSIX).

**Bốn, sổ sách.** Phiên bản 0.7.0 → **0.8.0** ở `package.json`, `plugins/ccf/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, cộng 2 dòng tự tham chiếu trong `package-lock.json`. `CLAUDE.md` cập nhật mục "Current plan". Số lượng thành phần KHÔNG đổi: 6 lệnh, 6 agent, 9 hook, 1 skill (`agent-match.mjs` và `io.test.mjs` là THƯ VIỆN, không phải hook).

## LỖI THẬT ĐÀO RA, ngoài kế hoạch
Khi thêm test cho `readStdinJson`: stdin là chuỗi `"null"` là **JSON hợp lệ nhưng không phải object**, khiến hook truy cập `input.prompt` và **crash exit 1**. Điều này vi phạm chính bất biến mà `hooks.md` ("always returns `{}` … so the hook NEVER crashes") và `testing.md` ("A hook MUST never crash on empty/malformed input") đã khai. Lỗi sống được vì **10 file test cũ, 0 file nào chạm `io.mjs`**. Đã sửa để chỉ trả về giá trị object thật. Đã kiểm: `"abc"`, `0`, `false`, `[]` vốn không gây crash (truy cập thuộc tính trên chúng không ném lỗi trong JavaScript), nên chỉ ca `null` là lỗi thật; payload object thật đi qua nguyên vẹn.

Reviewer phán xét việc này XỨNG ĐÁNG vượt phạm vi đã khai, vì nó **phục hồi một bất biến có sẵn** chứ không thêm hành vi mới, và deliverable của task vốn là file test cho `io.mjs`.

## LỖI NẶNG NHẤT vòng review, đã sửa
`io.test.mjs` ban đầu đột biến ghi **THẲNG vào `io.mjs` thật**, một file được git theo dõi và đóng gói cho người dùng. Khối `try/finally` KHÔNG chạy khi tiến trình bị SIGINT, SIGTERM, hay hết thời gian trong CI, nên file phát hành có thể bị bỏ lại với chuỗi `MUTATION-KILL-MARKER`. Đã sửa thành `cpSync` cả cây `hooks/` sang thư mục tạm rồi đột biến BẢN SAO. Chứng minh: `shasum` của `io.mjs` giống nhau trước và sau khi chạy test.

## Cửa kiểm, kết quả thật
- `node --test`: **167 → 190 pass, 0 fail** (sau các lượt sửa review và `/simplify`).
- `git diff -- io.mjs`: 0 dòng đổi trong thân mọi hàm TRỪ `emitPromptWarning`, `emitStopAdvisory`, `readStdinJson` (lỗi thật ở trên), và phần thêm mới.
- Phép thử phá logic: **PASS**, đỏ đúng khi phá, xanh lại sau khi hoàn nguyên.
- Smoke `updatespec-nudge` hai chiều: không cờ → stdout CHỈ có `{"systemMessage":...}` (đúng một khóa, bất biến); có cờ → cả `additionalContext` và `systemMessage`, nội dung KHÁC nhau.
- `tsc --noEmit` exit 0; `claude plugin validate` passed; template lib 8 pass 0 fail.
- Số thư mục `ccf-io-*` trong `$TMPDIR` không tăng sau khi chạy test (đã thêm `test.after` dọn; 215 thư mục rác cũ đã dọn).

## CỬA KIỂM CHƯA LÀM — không được coi là xong
**Quan sát trọn gói BỐN công tắc** sau khi nạp lại plugin: `--dual-channel-stop`, `--auto-verify`, `--enforce-tests`, `--hard-block`. Repo giờ có bốn cờ mà **chưa cờ nào từng được thấy chạy thật** (`--auto-verify` từ `028a`, `--enforce-tests` từ `034a`, cả hai đóng việc mà chưa ai bật). Nếu thêm cờ mà không quan sát thì spec lại nói sai theo chiều mới: nói CCF có năng lực đó, thực tế chưa ai thấy nó chạy. Sau khi quan sát **PHẢI hoàn nguyên `hooks.json`**, vì đó là file phát hành, không được vô tình phát hành ở trạng thái bật.

## Nợ đo được, đã ghi công khai
Bộ test chậm từ khoảng **114ms cho 170 test** lên khoảng **565 tới 620ms cho 190 test**, gấp khoảng 5 lần, vì `io.test.mjs` spawn **23 tiến trình `node` con** (mỗi lần 20 tới 30ms chỉ để khởi động runtime) cộng một lần `cpSync`. Đây là giá CỐ HỮU của cách test qua tiến trình thật: các hàm trong `io.mjs` tự gọi `process.exit` nên không test trong cùng tiến trình được. Đã ghi con số và lý do vào đầu `io.test.mjs` để không ai "tối ưu" bằng cách xoá nó.
