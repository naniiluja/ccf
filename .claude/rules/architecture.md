---
description: Kiến trúc plugin CCF — các loại artifact, ranh giới, luồng phân phối.
---

# Kiến trúc

## Ba loại artifact (đừng lẫn lộn vai trò)
1. **Command** (`plugins/ccf/commands/*.md`) — prompt điều khiển Claude trong **main conversation** khi người dùng gõ `/ccf:<name>`. KHÔNG phải script. Có frontmatter (`description`, `argument-hint`, `allowed-tools`, `model`).
2. **Agent / subagent** (`plugins/ccf/agents/*.md`) — prompt chạy trong context **tách biệt** khi được giao việc qua Task. Có frontmatter (`name`, `description`, `model`, `tools`). Dùng khi cần isolate context hoặc fan-out research read-only.
3. **Hook** (`plugins/ccf/hooks/*.mjs`) — code Node thực thi ngoài process, do Claude Code gọi tại các event lifecycle. Đây là phần DETERMINISTIC duy nhất; phần còn lại là prompt.

## Ranh giới command ↔ agent (luật CCF)
- Việc **share context** (plan → implement → test) ở lại main conversation (command), KHÔNG tách ra agent.
- Chỉ tách ra agent khi: (a) research read-only có thể fan-out song song (vd 5 `ccf-codebase-analyzer` trong `/ccf-init`), hoặc (b) cần một đơn vị làm việc isolate (1 `ccf-implementer` cho đúng 1 task).
- **KHÔNG spawn nhiều agent GHI file song song** trên cùng feature. Song song chỉ cho research read-only.

## Phần deterministic vs phần prompt
- Logic phải chắc chắn (vd "chặn `/ccf-plan` nếu không ở plan mode") → đặt trong **hook** (`plan-mode-guard.mjs`), vì prompt có thể bị model bỏ qua. Command vẫn giữ một lớp backup bằng lời (xem `ccf-plan.md` mục 0) — đây là defense-in-depth có chủ đích, không phải trùng lặp thừa.
- Logic mang tính phán đoán/diễn giải → đặt trong **command/agent prompt**.

## Luồng phân phối
`bin/ccf-bootstrap.mjs` (npx) → `claude plugin marketplace add` + `install` → Claude Code đọc `.claude-plugin/marketplace.json` → trỏ tới `plugins/ccf` → đọc `.claude-plugin/plugin.json` → nạp commands/agents/hooks/.mcp.json.

## Bất biến
- Mọi tên command trong tài liệu/prompt phải khớp file thật trong `commands/`. Hiện có **6** command và **6** agent — nếu README/MEMORY nói "5", đó là drift cần sửa, không phải nguồn chân lý.
- Component reference lẫn nhau bằng tên (vd command gọi agent `ccf-implementer`); đổi tên một file ⇒ phải cập nhật mọi reference.
