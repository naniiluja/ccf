---
description: Tạo plan implementation tuần tự (waterfall), grounding bằng best practice. Yêu cầu plan mode.
argument-hint: "[feature hoặc thay đổi cần plan]"
allowed-tools: Read, Glob, Grep, Skill, Task, WebFetch, mcp__context7__resolve-library-id, mcp__context7__query-docs, mcp__microsoft-learn__*
model: opus
---

Bạn đang chạy CCF `/ccf-plan`.

## 0. Cổng plan mode (backup cho hook)
**DỪNG.** Xác minh session đang ở **plan mode**. Nếu KHÔNG ở plan mode, TỪ CHỐI: bảo người dùng vào plan mode (Shift+Tab xoay tới 'plan', hoặc `--permission-mode plan`) rồi chạy lại `/ccf:ccf-plan`. Không tiếp tục. (Hook plan-mode-guard cũng chặn việc này một cách deterministic; đây là lớp backup.)

## 1. Đọc context hiện có
Đọc `CLAUDE.md` (root + nested) + `.claude/rules/*` + `.claude/plan/PLAN.md`. Plan mới phải nhất quán với spec và slot vào backlog tuần tự đang có.

## 2. Interview
Gọi skill `grill-me` phỏng vấn **từng câu một** về feature cụ thể: acceptance criteria, edge case, data shape, failure mode, test case. Explore codebase để tự trả lời trước khi hỏi.

## 3. Grounding best practice
Trước khi chốt, nâng plan lên chất lượng best-practice: gọi Context7 (`resolve-library-id` → `query-docs`) cho các thư viện liên quan và Microsoft Learn cho hướng dẫn platform — hoặc giao `ccf-best-practice-researcher` qua Task. Gấp các phát hiện vào plan.

## 4. Luật SEQUENTIAL (cốt lõi CCF)
- Plan LUÔN tuần tự waterfall. Order task nhỏ → lớn.
- Mỗi task: spec → **failing test** → implement (verification-first — "việc đòn bẩy cao nhất").
- **KHÔNG BAO GIỜ chạy 2 agent song song trên cùng feature.** Với feature A, B, C: hoàn tất BE của A → FE của A → MỚI tới B.
- Mặc định một task một lần để đảm bảo chất lượng. Lý do (Anthropic): các pha chia sẻ context (planning→implementation→testing) nên ở main conversation; prompt chaining tuần tự đánh đổi latency lấy độ chính xác; task nhiều dependency không hợp multi-agent song song.

## 5. Output plan
Ghi/append task files `.claude/plan/task-NNN-*.md` (dùng mẫu task-template). Mỗi task = một đơn vị cỡ PR: goal, spec ref, files to touch, test viết trước, acceptance criteria, **đúng MỘT predecessor**, và **gợi ý agent/MCP nên dùng khi implement task này**. (Trong plan mode, việc ghi được trình bày như plan chờ duyệt.)

## 6. Implement bằng agent
Hướng dẫn execute MỖI task qua subagent **`ccf-implementer`** (có MCP để tra DB Supabase/Railway nếu tích hợp + tra Context7/MS Learn) thay vì main thread. Giữ luật sequential: KHÔNG chạy nhiều implementer song song trên các task phụ thuộc nhau. Mỗi task nên chạy trong session mới (context sạch). Ghi rõ trong task file agent + MCP nào dùng. Cập nhật status `in-progress`/`done` trong `PLAN.md` kịp thời.

## 7. Kết thúc
Khuyên execute từng task trong session mới; sau implement nhắc `/ccf:ccf-check` → `/code-review` → `/ccf:ccf-updatespec`.
