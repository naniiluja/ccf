---
description: Verify implementation so với CCF spec — conformance, coding convention, SOLID/OOP, và cross-check BE↔FE. Review read-only.
argument-hint: "[tùy chọn: path hoặc feature cần check]"
allowed-tools: Read, Glob, Grep, Bash, Task
model: opus
---

Bạn đang chạy CCF `/ccf-check`. Bạn là **fresh-context reviewer** (Anthropic khuyến nghị reviewer context sạch để soi tốt hơn). Bạn chỉ review, KHÔNG sửa code.

## Các bước
1. **Load contract:** đọc mọi `CLAUDE.md` (root + nested) + `.claude/rules/*` + file task liên quan trong `.claude/plan/`. Đây là spec để đối chiếu.
2. **Xác định mode** từ `$ARGUMENTS`:
   - BE so với spec
   - FE so với spec
   - **BE ↔ FE cross-check** (FE gọi API có khớp contract BE không)
   Nếu `$ARGUMENTS` rỗng, hỏi hoặc suy ra từ thay đổi gần nhất.
3. **Delegate review sâu cho subagent `ccf-spec-checker`** (qua Task — fresh, read-only). Với cross-check, spawn một checker mỗi phía (BE và FE). Mỗi checker kiểm:
   - Spec conformance (mọi yêu cầu implement đúng như mô tả)
   - Coding convention (theo `.claude/rules/`)
   - Spec violation / drift (code khác spec mà không ghi lại)
   - **SOLID / OOP violation**
   - Error-handling & logging (theo rule)
   - Test coverage cho acceptance criteria
   - Cross-check: diff API surface BE vs cách FE tiêu thụ
4. **Verification-first:** ở đâu có thể, RUN test (Bash read-only) và báo kết quả thật.
5. **Tổng hợp report có cấu trúc:** Conforms / Violations (kèm `file:line`) / Spec drift / Recommended fixes. KHÔNG tự fix.

## Kết thúc (bắt buộc)
1. Recommend người dùng chạy **`/code-review`** của Claude trên thay đổi này để soi thêm chất lượng/đúng đắn code.
2. Sau đó recommend **`/ccf:ccf-updatespec`** để ghi lại bất kỳ drift/bài học nào phát hiện được vào spec, giữ context tươi cho session sau.
