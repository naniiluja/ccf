# Implementation Plan — CCF (multi-iteration backlog; lead iteration at top)

> **Execution rule: STRICTLY SEQUENTIAL.** Do exactly one task at a time, in order.
> These tasks are slices sequenced for serial execution (thinnest → richest). Each `Depends on` = the prior task in the queue (serial law), unless a real data dependency is noted.
> Do not start task N+1 until task N's **gate is GREEN** (implemented + tested + checked).
> The `in-progress`/`in-review` status is read by the session-start hook to re-load context after compact — keep status up to date.

> **Scope of this file: the CURRENT iteration only.** Closed iterations and their postmortems live in
> `.claude/plan/ARCHIVE.md`; their task files live in `.claude/plan/archive/`. Keep it that way — a
> closed row left here is counted as live work by `lib/plan.mjs` (`findActiveTask` / `findNonDoneTasks`)
> and by the Stop nudge. When an iteration closes, move its `## Origin` / backlog / `## Closed`
> sections into `ARCHIVE.md` verbatim and `git mv` its task files into `archive/`.
> **Premortem note:** `ccf-spec-checker` and `/ccf:plan` step 6 anchor failure modes to real past
> iterations, so they must read `ARCHIVE.md` as well as this file.

## Origin: plan-skill (task 051 den 053)

Nguoi dung muon go `/plan` (built-in, bat plan mode) la kich hoat luong `ccf:plan`, va muon `ccf:plan` la skill thay vi command. Docs (Context7) xac nhan: command va skill da gop, cung nang luc; ten `/plan` la built-in bi giu rieng nen skill plugin khong chiem duoc, plugin skill luon la `/ccf:plan`. Vi vay plan mode chinh la tin hieu kich hoat: mot hook `UserPromptSubmit` moi nhac model goi skill `ccf:plan`, description cua skill la du phong. Ke hoach chi tiet: `~/.claude/plans/t-ch-h-p-jev-typesafe-curried-goblet.md`. Quyet dinh nguoi dung: hook + description, chuyen file that sang `skills/plan/SKILL.md`. Tich hop Jev dang gac (bao cao analyzer nam trong ke hoach do), khong bo.

## Task backlog — plan-skill (in execution order)
| # | Slice | Layers | Gate (tests green) | Depends on | Status |
|---|-------|--------|--------------------|-----------|--------|
| 051 | Hook `plan-skill-inject` + dong bo so hook 5 sang 6 | 1 lib + 1 hook + 1 test lib + 1 ca io.test + hooks.json + 4 spec/doc | test bang quyet dinh do roi xanh + node --test hook lib + tsc + smoke stdin + grep khong con "5 hook" | — | done |
| 052 | Chuyen `commands/plan.md` sang `skills/plan/SKILL.md` + dong bo phan loai va so dem | 1 file chuyen + description + 2 rule + CLAUDE.md + 3 README + plugin README + prompt-standard | validate + ba bo test + tsc + grep khong con `commands/plan.md` + 7 ban sao khoi van phong cung md5 + do lai wc -c va nhan ccf-budget | 051 | done |
| 053 | Xac minh song 4 ca (Shift+Tab, `/plan <yc>`, `/ccf:plan` ngoai plan mode, hoi dap thuan) | quan sat tren plugin cai lai | 4 ca ghi ket qua that, ca nao chua chay ghi ro "chua quan sat" | 052 | done |

> Status: `todo` / `in-progress` / `in-review` / `done` / `blocked`. Lifecycle: `todo → in-progress → in-review → done`. Chi `/ccf:updatespec` ghi `done`, sau `/ccf:check`. Khong bump version, khong commit tru khi nguoi dung yeu cau.

## Origin: jev-integration (task 054 den 057)

Nguoi dung muon dua Jev (TypeSafe System One, tra xac suat Noul) vao workflow CCF: (A) gate bang chung hoan thanh advisory truoc khi `/ccf:updatespec` ghi `done`, (B) kiem chat luong chia task trong `ccf:plan`. Quyet dinh nguoi dung: lam ca hai tuan tu, gui diff day du. Hop dong API da doc tu docs.typesafe.ai: `POST https://api.typesafe.ai/v1/systemone`, `Authorization: Bearer $TYPESAFE_API_KEY`, body `{state, model:"jev-latest", questions}`, dap `answers.<id>.noul` trong 0..1; docs KHONG neu gioi han state, so cau toi da, timeout, do tre, gia, chinh sach luu tru. Ke hoach chi tiet: `~/.claude/plans/t-ch-h-p-jev-typesafe-curried-goblet.md`. Ngoai le co chu dich voi luat tuan tu: 054 chon predecessor la 052 (da qua `/ccf:check` sach), khong phai 053, vi 053 la buoc quan sat tay cua nguoi dung, khong co phu thuoc ma; 053 van mo song song.

## Task backlog — jev-integration (in execution order)
| # | Slice | Layers | Gate (tests green) | Depends on | Status |
|---|-------|--------|--------------------|-----------|--------|
| 054 | Loi Jev: `jev-client` (fetch tiem qua tham so) + `completion-evidence` thuan | 2 lib + 2 test lib + `plan.mjs#findInReviewTask` | node --test hook lib + tsc, khong dung mang that | 052 | done |
| 055 | Hook `completion-evidence` (Stop, opt-in) + dong bo so hook 6 sang 7 + README/tooling | 1 hook + hooks.json + ca io.test voi may chu gia + 6 spec/doc | ba bo test + tsc + validate + smoke stdin + grep khong con "= 6" + do lai ngan sach | 054 | done |
| 056 | Script `jev-slice-check` + noi vao buoc 4 cua skill `plan` | 1 script + lib thuan + test + SKILL.md | ba bo test + tsc + validate + grep so dem script 1 sang 2 | 055 | done |
| 057 | Xac minh song va hieu chinh nguong (can key that) | quan sat tren plugin cai lai | do tre, gioi han, nguong hieu chinh tren ARCHIVE, ca thieu tieu chi co y; ca chua chay ghi "chua quan sat" | 056 | done |
