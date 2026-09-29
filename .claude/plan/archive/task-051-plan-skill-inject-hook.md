# Task 051 — Hook plan-skill-inject + dong bo so hook

- **Vertical slice:** lib thuan (quyet dinh) + hook I/O mong + hooks.json + test + spec/doc so dem
- **Depends on:** none
- **Spec refs:** `.claude/rules/hooks.md` (I/O contract, Hook-writing conventions), `architecture.md` (Deterministic part vs prompt part), `testing.md`
- **MCP to use:** none
- **Gate (must be GREEN before the next slice):** unit (bang quyet dinh) + process-level (`io.test.mjs` runHook) + `tsc`; smoke stdin bang pipe

## Goal (one sentence)
Khi session o plan mode trong du an da khoi tao CCF, mot hook `UserPromptSubmit` nhac model goi skill `ccf:plan` toi da mot lan moi session, khong bao gio chan prompt.

## Acceptance criteria (verifiable)
- [ ] `shouldInjectPlanSkill({ mode, managed, isCcfSlash, alreadyInjected, skillAlreadyRan })` tra true CHI khi mode la `plan`, managed, khong phai `/ccf:*`, chua inject, skill chua chay; moi dau vao doi mot lan thi ket qua doi; dau vao rac thi false
- [ ] `hasPlanSkillRun(records)` nhan Skill tool_use ten `ccf:plan` hoac `plan` (assistant), va the `<command-name>/ccf:plan` trong user record; khong nhan van ban tu do
- [ ] Hook: ngoai plan mode im lang (exit 0); trong plan mode + managed in JSON co `additionalContext`; stdin rong/`null`/`{{{` thi exit 0; moi loi thi exit 0
- [ ] Marker theo `session_id` trong thu muc tam (khong ghi file cua nguoi dung), loi ghi marker thi van exit 0
- [ ] `hooks.json`: them object vao mang `UserPromptSubmit` sau `plan-mode-guard`; cap nhat `description`
- [ ] So hook 5 thanh 6 dong bo o `CLAUDE.md:17,55`, `architecture.md`, `hooks.md`, bang hook 3 README, `plugins/ccf/README.md`; cau "plan-mode-guard la hook UserPromptSubmit duy nhat" duoc sua; `grep` khong con "5 hook"
- [ ] `tsconfig.json` khong can sua (glob `hooks/**/*.mjs` phu san, da doc file that)

## Test first (write before implementing)
`plugins/ccf/hooks/lib/plan-trigger.test.mjs` (bang quyet dinh + `hasPlanSkillRun`) va them ca process-level vao `io.test.mjs` theo mau `runHook`. Xac nhan DO truoc khi viet lib.

## Files to touch
- plugins/ccf/hooks/lib/plan-trigger.mjs — moi, thuan, JSDoc
- plugins/ccf/hooks/plan-skill-inject.mjs — moi, I/O mong
- plugins/ccf/hooks/hooks.json — them entry + description
- plugins/ccf/hooks/lib/plan-trigger.test.mjs, io.test.mjs — test
- CLAUDE.md, .claude/rules/architecture.md, .claude/rules/hooks.md, README.md/.vi/.zh-CN, plugins/ccf/README.md — so dem + mo ta

## Notes
Tai su dung `emitContext` (`hooks/lib/io.mjs`), `parseJsonl` (`hooks/lib/review-trace.mjs`). Ngan sach context: hooks.md tang, do lai `wc -lc` o task 052 buoc cuoi.
