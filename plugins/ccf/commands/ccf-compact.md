---
description: Sinh hint compact tối ưu từ task đang làm, rồi hướng dẫn bạn chạy /compact <hint> — tránh để auto-compact tự kích hoạt khi context đã rot.
argument-hint: ""
allowed-tools: Read, Glob, Grep
model: sonnet
---

Bạn đang chạy CCF `/ccf-compact`. Mục tiêu: giúp người dùng **compact chủ động có hint** thay vì để auto-compact tự kích hoạt.

## Vì sao
Auto-compact kích hoạt khi context đã đầy — đúng lúc mô hình kém minh mẫn nhất (context rot), nên bản tóm tắt dễ giữ sai thứ. Compact chủ động sớm với hint cụ thể giữ lại đúng phần cần thiết.

> Lưu ý: bạn (Claude) KHÔNG tự chạy được `/compact`. Lệnh này chỉ **sinh hint tốt nhất** rồi in ra dòng lệnh để người dùng copy.

## Các bước
1. **Xác định task đang làm:** đọc `.claude/plan/PLAN.md`, tìm task có status `in-progress`. Đọc file `task-NNN-*.md` tương ứng (goal, spec refs, files to touch, acceptance criteria còn dở). Nếu không có task in-progress, dựa vào việc đang làm gần nhất trong session.
2. **Tổng hợp những gì cần GIỮ:** task NNN + goal + spec refs + (các) file đang sửa + quyết định/phát hiện quan trọng đã rút ra trong session này.
3. **Tổng hợp những gì nên BỎ:** log debug đã giải quyết xong, kết quả explore không còn liên quan, các nhánh tiếp cận đã từ bỏ, output dài đã dùng xong.
4. **In ra cho người dùng đúng dòng lệnh để copy**, theo mẫu:
   ```
   /compact focus on <task NNN + goal + file đang sửa + quyết định cần giữ>, drop <thứ không còn liên quan>
   ```
5. Nhắc người dùng: sau khi compact, hook SessionStart của CCF sẽ tự re-load task in-progress từ plan, nên không cần dán lại toàn bộ context.

Giữ hint ngắn gọn, cụ thể, đúng trọng tâm task hiện tại.
