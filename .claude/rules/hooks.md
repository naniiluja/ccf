---
description: Hợp đồng hook Claude Code và quy ước viết hook .mjs của CCF.
paths: plugins/ccf/hooks/**
---

# Hooks (`plugins/ccf/hooks/*.mjs`)

## Bất biến tuyệt đối
- **No-build, no-dependency, Windows-clean.** Hook là `.mjs` ESM chạy thẳng bằng `node` (Node ≥ 18). KHÔNG thêm npm dependency, KHÔNG thêm bước transpile/bundle. Mọi I/O qua `node:fs`, `node:path`, `node:child_process` built-in.
- Type-check bằng `tsc` với `checkJs` + JSDoc (xem `tsconfig.json`). KHÔNG đổi sang `.ts`.
- Đường dẫn trong `hooks.json` dùng `node "${CLAUDE_PLUGIN_ROOT}/hooks/<file>.mjs"` — biến này CHỈ expand trong hook command.

## Hợp đồng I/O (đã đóng gói trong `hooks/lib/io.mjs` — dùng lại, đừng tự viết)
- **Đọc stdin**: `readStdinJson()` — luôn trả `{}` khi rỗng/TTY/parse lỗi để hook KHÔNG BAO GIỜ crash.
- **Bơm context (không block)**: `emitContext(eventName, text)` — in `{ hookSpecificOutput: { hookEventName, additionalContext } }` rồi `exit 0`. Dùng cho SessionStart, Stop, PreToolUse, PostToolUse.
- **Chặn prompt**: `blockUserPrompt(reason)` — ghi `reason` ra stderr rồi `exit 2`. Chỉ UserPromptSubmit.

## Exit code semantics (theo tài liệu Claude Code)
- `exit 0` — không quyết định, luồng tiếp tục bình thường (kể cả khi đã emit additionalContext).
- `exit 2` — **BLOCK**; stderr được gửi về làm feedback. Đây là cách chặn duy nhất CCF dùng.
- `exit 1` — non-blocking error, KHÔNG chặn. CCF tránh dùng (sẽ gây nhiễu mà không có tác dụng chặn).

## Sự kiện CCF đang dùng (`hooks.json`)
- `UserPromptSubmit` → `plan-mode-guard.mjs`: chỉ can thiệp prompt chứa `/ccf-plan` (regex namespaced + bare); chặn nếu `permission_mode !== "plan"`. Mọi prompt khác `exit 0` ngay.
- `SessionStart` (matcher `startup|clear|compact`) → `session-start.mjs`: bơm reminder context-first; nếu đã CCF-managed thì thêm tín hiệu freshness + re-load task in-progress sau `compact`/`clear`.
- `Stop` → `updatespec-nudge.mjs`: THUẦN ADVISORY, không bao giờ block. Phải kiểm `input.stop_hook_active` để tránh vòng lặp.

## Quy ước viết hook
- Mỗi hook bắt đầu bằng `#!/usr/bin/env node` + comment mô tả event, cơ chế, vai trò.
- Phòng thủ: mọi `readdirSync`/`statSync`/`readFileSync` bọc try/catch, lỗi → bỏ qua entry (heuristic freshness chỉ để nhắc, không được làm hỏng session).
- Giới hạn độ sâu đệ quy khi quét cây (vd `newestMtime(dir, depth)`); luôn skip `node_modules` và `.git`.
- Hook chạy đồng bộ và block Claude — giữ nhanh; `hooks.json` đặt `timeout` (giây) cho mỗi hook.
- Khi thêm hook mới: thêm entry vào `hooks.json` + comment, tái dùng `io.mjs`, thêm file vào `include` của `tsconfig.json` nếu chưa khớp glob.
