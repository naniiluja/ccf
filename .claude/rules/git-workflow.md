---
description: Quy ước git và phân phối/versioning cho plugin CCF.
---

# Git workflow & phân phối

## Git
- **KHÔNG commit/push/tạo branch khi người dùng chưa yêu cầu rõ ràng.** Đây là luật cứng của CCF và của output style — áp dụng cho cả hook, command, agent, spec.
- git init ở **gốc repo**, không ở thư mục con. `.gitignore` đã loại `node_modules/`, `dist/`, `*.log`, `.env*`.
- Khi được yêu cầu commit: message mô tả thay đổi theo loại artifact (vd `feat: thêm hook X`, `docs: đồng bộ README`).

## Versioning (đồng bộ 3 nơi — dễ drift)
Số version xuất hiện ở **ba** file, phải khớp nhau khi bump:
1. `package.json` → `version`
2. `plugins/ccf/.claude-plugin/plugin.json` → `version`
3. `.claude-plugin/marketplace.json` → `plugins[0].version`

Thứ tự resolution của Claude Code: `plugin.json` > `marketplace.json` > git SHA. Nhưng vẫn giữ cả ba đồng bộ để tránh nhầm lẫn cho người cài.

## Đồng bộ khi đổi cấu trúc plugin
Một thay đổi cấu trúc thường phải sửa nhiều file — kiểm đủ trước khi coi là xong:
- Thêm/đổi/xóa **command** → `commands/`, README (bảng lệnh), cross-reference trong các prompt khác.
- Thêm/đổi/xóa **agent** → `agents/`, mọi command gọi nó qua Task, README nếu liệt kê.
- Thêm/đổi **hook** → `hooks/<file>.mjs`, `hooks/hooks.json`, `tsconfig.json` (glob `include`).
- Thêm **MCP** → `.mcp.json`, `allowed-tools`/`tools` của command/agent dùng nó, `tooling.md`.

## README là tài liệu người dùng, spec là cho Claude
README + spec phải nhất quán về số lượng/ tên command. Nếu lệch (vd README ghi "5 command" trong khi có 6), coi là **drift** cần sửa ở lần chạm tới — README/MEMORY không phải nguồn chân lý, file thật trong `commands/`+`agents/` mới là.
