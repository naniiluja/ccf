---
description: Bootstrap dự án mới hoặc onboard dự án có sẵn vào workflow CCF — sinh CLAUDE.md + .claude spec + plan tuần tự ban đầu.
argument-hint: "[tùy chọn: mô tả ngắn thứ bạn muốn xây]"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Task, Skill, WebFetch, mcp__context7__resolve-library-id, mcp__context7__query-docs, mcp__microsoft-learn__*
model: opus
---

Bạn đang chạy CCF `/ccf-init`. Nhiệm vụ: tạo một lớp context tươi, grounding best-practice (CLAUDE.md + `.claude/`) và một plan implementation tuần tự ban đầu. Theo workflow Anthropic Explore → Plan. **KHÔNG viết code ứng dụng trong lệnh này.**

Template nằm ở `${CLAUDE_PLUGIN_ROOT}/templates/`. Đọc và instantiate chúng (thay placeholder `{{...}}`) khi sinh file thật vào dự án.

## Bước 0: Phân loại dự án
Scan read-only `cwd` (Glob `**/*` bỏ qua `node_modules`/`.git`; kiểm tra `package.json`, `src/`, `CLAUDE.md` sẵn có). Phân loại **EMPTY** (chưa có gì đáng kể) hay **EXISTING** (đã có code).

---

## Nhánh A — EMPTY project

### A1. Interview (grill-me)
Gọi skill `grill-me` để phỏng vấn người dùng **từng câu một**. Trước mỗi câu, nếu có thể trả lời bằng explore codebase thì explore trước; chỉ hỏi điều code không nói được. Đi qua cây quyết định sau (mỗi câu kèm đề xuất của bạn):
- (a) Hệ thống gì + bài toán cốt lõi?
- (b) Budget/chi phí chấp nhận được?
- (c) Loại app: REST API / frontend / backend / fullstack?
- (d) Quy mô người dùng dự kiến? → **dựa vào quy mô, đề xuất hosting** (vd Supabase hoặc Railway) và bảo người dùng cài MCP tương ứng (`/plugin install ...`).
- (e) Design pattern cho FE & BE?
- (f) Hệ thống logging tối ưu cho AI trace (structured log, correlation ID, prefix nhất quán)?
- (g) Database?
- (h) Coding convention?
- (i) Chiến lược testing?
- (j) **Tech stack — phải ổn định nhất, được support rộng nhất, ít bug nhất** (mainstream); mỗi thư viện chọn loại phổ biến/được maintain tốt nhất.
- (k) **Quy tắc monorepo:** làm việc trong thư mục gốc; nếu fullstack tạo `be/` + `fe/`; **git init ở gốc, KHÔNG ở thư mục con**; gốc chứa CLAUDE.md, `.claude/`, docker, CI/CD.

Tổng hợp thành **"decisions summary"** và trình người dùng xác nhận.

### A2. Grounding best-practice
Với mỗi design pattern / DB design / framework đã chọn, **đối chiếu tài liệu trước khi viết spec**. Giao `ccf-best-practice-researcher` (qua Task) — hoặc gọi trực tiếp Context7 (`resolve-library-id` → `query-docs`) và Microsoft Learn docs tool. Trích dẫn những gì học được vào spec.

### A3. Sinh file spec
Đọc template ở `${CLAUDE_PLUGIN_ROOT}/templates/root/`, instantiate, ghi root `CLAUDE.md` + `.claude/rules/*` vào thư mục gốc. Nếu **fullstack**: ghi thêm `CLAUDE.md` + `.claude/rules/*` lồng trong `be/` (template `templates/backend/`) và `fe/` (template `templates/frontend/`).
- Mọi `CLAUDE.md` < 200 dòng; đẩy chi tiết vào `.claude/rules/*` qua `@import` (max depth 5).
- Rule cụ thể & verifiable. Loại bỏ thứ Claude tự suy ra được.
- Rule scope theo path dùng frontmatter `paths:` (vd `be/**`, `fe/**`).

### A4. Sinh plan ban đầu
Sinh một plan lớn ở `.claude/plan/` dùng template (`PLAN.md` index + các `task-NNN-*.md`), cấu trúc **tuần tự waterfall** (nhỏ → lớn, spec → test → implement). Mỗi task đúng một predecessor.

### A5. Kết thúc
KHÔNG chạy git. Bảo người dùng start session mới và chạy `/ccf:ccf-plan` (trong plan mode) khi sẵn sàng chi tiết hóa feature đầu tiên. Nhắc: nếu Context7 gặp rate-limit, set free `CONTEXT7_API_KEY` env var rồi khởi động lại Claude Code.

---

## Nhánh B — EXISTING project

### B1. Phân tích bằng 5 agent song song
Launch **5 subagent `ccf-codebase-analyzer` song song** (qua Task — đây là chỗ DUY NHẤT CCF cho phép song song, vì là research read-only). Mỗi cái một slice:
1. Architecture & module boundaries
2. Data layer & DB
3. API surface
4. Frontend & state
5. Build/test/CI + convention & logging

Mỗi agent trả report có cấu trúc; **không được ghi file**.

### B2. Tổng hợp + validate
Tổng hợp 5 report. Đối chiếu pattern quan sát được với best practice qua Context7 + Microsoft Learn (hoặc `ccf-best-practice-researcher`), flag drift.

### B3. Sinh spec phản ánh code THỰC TẾ
Sinh `CLAUDE.md` + `.claude/` mô tả codebase đang có (không phải lý tưởng hóa), cùng bộ template + cùng quy tắc < 200 dòng / `@import`. Nếu là monorepo nhiều sub-package, sinh nested CLAUDE.md cho từng package.

### B4. Kết thúc
Đề xuất chạy `/ccf:ccf-plan` cho công việc mới. KHÔNG commit.

---

## Guardrails (cả hai nhánh)
- Một task một lần; KHÔNG spawn agent **ghi** song song (chỉ research read-only mới được song song).
- Spec phải verifiable.
- KHÔNG chạy git khi người dùng chưa yêu cầu.
