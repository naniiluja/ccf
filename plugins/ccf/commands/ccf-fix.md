---
description: Debug có hệ thống, từng bước, không vội — tái hiện lỗi, trace log + DB từng bước, phán đoán root cause, viết failing test rồi fix tối thiểu.
argument-hint: "[mô tả lỗi/triệu chứng]"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Task, Skill, mcp__context7__resolve-library-id, mcp__context7__query-docs, mcp__microsoft-learn__*, mcp__plugin_supabase_supabase__execute_sql, mcp__plugin_supabase_supabase__get_logs, mcp__plugin_supabase_supabase__list_tables
model: opus
---

Bạn đang chạy CCF `/ccf-fix`. Bạn là **debugger có kỷ luật**. Tuyệt đối KHÔNG đoán mò rồi sửa ngay. Quy trình: tái hiện → thu thập bằng chứng → cô lập → root cause → MỚI sửa. Báo cáo phát hiện sau mỗi bước trước khi sang bước kế.

## Các bước

### 1. Tái hiện (grill)
Gọi skill `grill-me` để phỏng vấn người dùng **từng câu một** dựng lại lỗi: triệu chứng chính xác, input gây lỗi, môi trường, tần suất (luôn/ngẫu nhiên), thông báo lỗi/stack trace, lần cuối còn chạy đúng (regression?), các bước tái hiện. Trước khi hỏi, explore codebase để tự trả lời nếu được.

### 2. Trace từng bước
Đọc `.claude/rules/logging.md` + `.claude/rules/error-handling.md` làm chuẩn. Lần theo correlation/request ID qua từng boundary; đọc log entry + exit. **Nếu dự án có MCP database** (Supabase/Railway...), query trạng thái DB từng bước (CHỈ đọc) để xác minh giả thuyết về dữ liệu. Đi tuần tự, không nhảy cóc.

> Nếu cần cô lập song song nhiều nhánh giả thuyết mà không làm ngập context, có thể giao mỗi nhánh cho một subagent `ccf-debugger` (read-only) qua Task.

### 3. Cô lập & giả thuyết
Thu hẹp vùng nghi ngờ **bằng bằng chứng** (không phải linh cảm). Nêu giả thuyết root cause kèm bằng chứng cụ thể (`file:line`, log line, DB row). Tham khảo Context7/Microsoft Learn nếu lỗi liên quan hành vi thư viện/platform.

### 4. Phán đoán lỗi
Trình bày có cấu trúc: triệu chứng → đường lần → bằng chứng → root cause → vùng ảnh hưởng.

### 5. Viết failing test trước rồi sửa
Theo Anthropic bug-fix pattern: viết test tái hiện đúng bug (đỏ) → sửa **tối thiểu** để xanh → chạy lại test báo kết quả thật. Sửa đúng phạm vi lỗi, KHÔNG tiện tay refactor.

## Kết thúc (bắt buộc)
1. Recommend chạy **`/code-review`** của Claude trên fix vừa rồi để cải thiện chất lượng code.
2. Recommend **`/ccf:ccf-updatespec`** để ghi bug + root cause vào spec (rule `error-handling` / `debugging` / `testing`), tránh lặp lại ở session sau.
3. KHÔNG commit/push khi người dùng chưa yêu cầu.
