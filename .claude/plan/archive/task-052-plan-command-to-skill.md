# Task 052 — Chuyen commands/plan.md sang skills/plan/SKILL.md

- **Vertical slice:** file prompt + description + phan loai artifact + so dem + ngan sach context
- **Depends on:** 051
- **Spec refs:** `components.md` (Skill), `architecture.md` (Artifact types, Invariants), `.claude/rules/prompt-standard.md` (checklist 11, 12; nhan ccf-budget)
- **MCP to use:** none
- **Gate (must be GREEN before the next slice):** `claude plugin validate plugins/ccf` + ba bo test + `tsc` + grep nhat quan + do lai `wc -lc`

## Goal (one sentence)
`ccf:plan` la skill (`skills/plan/SKILL.md`) van chay duoc bang `/ccf:plan`, description dan bang tu khoa trigger, va spec/so dem phan anh dung.

## Acceptance criteria (verifiable)
- [ ] `git mv plugins/ccf/commands/plan.md plugins/ccf/skills/plan/SKILL.md`; frontmatter `name: plan`, giu `argument-hint`, `allowed-tools`, `model: opus`; khong dat `disable-model-invocation` hay `user-invocable: false`; description < 1.536 ky tu, tu khoa trigger dat dau
- [ ] Kiem chung: `claude plugin validate plugins/ccf` sach, va `allowed-tools` cua skill la cap quyen (khong bo sot cong cu than bai can)
- [ ] `architecture.md` + `components.md`: phan loai skill viet lai thanh hai loai (khoi noi bo `grill-me` va skill quy trinh nguoi dung goi nhu `ccf:plan`)
- [ ] So dem 5 cmd / 1 skill thanh 4 cmd / 2 skill o `CLAUDE.md:14,16,55`, 3 README, `plugins/ccf/README.md`
- [ ] `grep` khong con `commands/plan.md` (tru lich su ARCHIVE); duong dan dang tep, "`plan.md` step 6/1b", `prompt-standard.md`, comment `plan-mode-guard.mjs` da cap nhat
- [ ] 7 ban sao khoi van phong con dung 7 file, cung md5 (`grep -rln "^- Write in the SAME language" plugins/ccf`)
- [ ] Buoc cuoi: `wc -lc CLAUDE.md .claude/rules/*.md`, cap nhat nhan `ccf-budget` trong `prompt-standard.md`, `node --test .claude/tests/*.test.mjs` xanh; `CLAUDE.md` < 200 dong va < 12KB

## Test first (write before implementing)
Day la thay doi prompt/spec: "verify" la `claude plugin validate` + grep nhat quan + `context-budget.test.mjs` (dong vai latch, phai thay DO neu quen do lai nhan).

## Files to touch
- plugins/ccf/skills/plan/SKILL.md (moi, tu git mv) — frontmatter + description
- .claude/rules/architecture.md, components.md, prompt-standard.md, hooks.md (neu con nhac commands/plan.md)
- CLAUDE.md, README.md/.vi/.zh-CN, plugins/ccf/README.md — so dem + duong dan
- plugins/ccf/hooks/plan-mode-guard.mjs — chi comment neu nhac duong dan tep

## Notes
Ten `/ccf:plan` khong doi nen khoang 85 tham chieu `/ccf:plan` giu nguyen.
