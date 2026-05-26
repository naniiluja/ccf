# CCF Plugin

Plugin Claude Context First. Xem [README gốc](../../README.md) cho hướng dẫn cài đặt và tổng quan.

## Cấu trúc plugin

```
plugins/ccf/
├─ .claude-plugin/plugin.json   # manifest
├─ .mcp.json                    # microsoft-learn + context7 (HTTP, key-less)
├─ commands/                    # 6 slash command (markdown prompt)
│  ├─ ccf-init.md  ccf-plan.md  ccf-check.md
│  ├─ ccf-fix.md   ccf-updatespec.md  ccf-compact.md
├─ agents/                      # 6 subagent
│  ├─ ccf-codebase-analyzer.md       # x5 song song onboard dự án có sẵn
│  ├─ ccf-best-practice-researcher.md# fetch best practice Context7/MS Learn
│  ├─ ccf-implementer.md             # implement 1 task (có MCP)
│  ├─ ccf-spec-writer.md             # draft spec
│  ├─ ccf-spec-checker.md            # fresh-context reviewer
│  └─ ccf-debugger.md                # điều tra 1 nhánh root cause
├─ hooks/
│  ├─ hooks.json
│  ├─ lib/io.mjs                # helper stdin/stdout JSON
│  ├─ plan-mode-guard.mjs       # UserPromptSubmit: chặn /ccf-plan ngoài plan mode
│  ├─ session-start.mjs         # SessionStart: reminder + re-load task sau compact
│  └─ updatespec-nudge.mjs      # Stop: nhắc /ccf-updatespec
└─ templates/                   # đọc bởi /ccf-init để sinh file (không auto-load)
   ├─ root/      backend/      frontend/
```

## Hook

Chạy trực tiếp bằng `node "${CLAUDE_PLUGIN_ROOT}/hooks/<file>.mjs"`. Không build, không dependency.
File `.mjs` (không phải `.sh`) để tránh việc Claude Code trên Windows tự prepend `bash`.

Test thủ công:
```bash
echo '{"prompt":"/ccf:ccf-plan","permission_mode":"default"}' | node hooks/plan-mode-guard.mjs
# exit 2 + stderr báo cần plan mode
```

## Template

`/ccf-init` đọc `templates/` rồi thay placeholder `{{...}}` và ghi `CLAUDE.md` + `.claude/` thật vào dự án. Mục tiêu: mỗi `CLAUDE.md` < 200 dòng nhờ `@import` các rule file (< 50 dòng/file).
