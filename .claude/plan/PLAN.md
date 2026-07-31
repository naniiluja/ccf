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

## Origin: latch-hardening (task 049, 050)

Luot /ccf:check song dau tien tren 0.8.7 de lai ba mon no (ghi trong task-048): hop dong ky hieu FAIL: khong co chot tu dong o dau may duy nhat (verify-chain.mjs), con so ngan sach context da bi noi sai bon lan lien tiep cung mot co che, va check.md/cook.md mang hai muc quyen Bash nguoc nhau du cung chay test cua du an dich. Ke hoach chi tiet: `~/.claude/plans/c-i-thi-n-l-i-workflow-inherited-flame.md` (ban 8, CLEAN sau 8 vong review ccf-spec-checker, disposition day du). Quyet dinh nguoi dung: Bash tran cho ca hai lenh, model sonnet, discipline off. Luot /ccf:plan lap ke hoach nay dong thoi la kiem song cua task 045 (di tron buoc 0, 1b voi 5 analyzer haiku chon qua AskUserQuestion, grill-me 0.8.7, 5b, 6, va plan-review-gate cho ExitPlanMode qua sau khi thay spec-checker spawn).

## Task backlog — latch-hardening (in execution order)
| # | Slice | Layers | Gate (tests green) | Depends on | Status |
|---|-------|--------|--------------------|-----------|--------|
| 049 | Chot tu dong (FAIL: token + ngan sach context) + Bash tran hai lenh | 1 helper + 1 test moi (.claude/tests) + 1 test sua + 4 rule/spec + 2 cmd + 1 agent + PLAN.md | phep thu pha logic do-roi-xanh tren BAN SAO + 227 giu nguyen + 8 template + bo .claude/tests moi + tsc + validate + quet codepoint node + do wc -c buoc cuoi | 048 | in-review |
| 050 | Chuyen templates len chuan prompt, thi hanh QUA /ccf:cook | 20 tmpl in-scope + settings.json.tmpl.md + prompt-standard.md + PLAN.md | tien dieu kien 049 = done; tieu chi duong 3 CLAUDE.md.tmpl day du hai nguong + wc -lc; hop dong may PLAN.md.tmpl (header nguyen byte, 5 status word, cau bare-word) + them `## Origin: {{ITERATION_NAME}}`; tap ten placeholder bang nhau tru dung mot ngoai le da ghi; 5 file khong doi byte; bon quan sat cook + diff khong rong | 049 | todo |

> Ghi chu thi hanh: 049 chay bang ccf-implementer trong PHIEN MOI (khong qua cook: tien nhiem 048 dang in-review nen cook se loai 049). 050 la luot kiem song cook.md, chi du dieu kien sau khi 049 len done (can /code-review chay tay qua PR tren nhanh, hoac nguoi dung chap nhan thieu co ghi dich danh).

> **UN-OBSERVED sau task 049 (ghi tuong minh):** `plugins/ccf/commands/cook.md:4` vua doi lan THU BA (`Bash(npx:*), Bash(node:*), Bash(claude:*)` → `Bash` tran), nhung `cook.md` van CHUA tung chay mot luot `/ccf:cook` nao tren ban moi (dong tinh trang UN-OBSERVED da ghi sau task 046). Vi vay lan sua allowlist nay cung UN-OBSERVED cho toi khi mot luot `/ccf:cook` that su thuc thi tren plugin da cai lai; task 050 (o tren) la co hoi kiem song gan nhat.

## Origin: prompt-standard (task 045 den 048)

Nguoi dung yeu cau chuan hoa toan bo 13 file prompt cua plugin theo tai lieu chinh thuc cua Anthropic va Claude Code (da tra cuu qua Context7 va code.claude.com), cong hai yeu cau rieng: dau ra phai theo bo quy tac anti-slop (khoi van phong v2, phu 9 file), va khong icon trong prompt lan tai lieu (chinh sach codepoint, bo ky hieu chu FAIL:/WARN:/PASS:). Duoc phep doi luong neu co trich dan; khong trich dan thi giu nguyen. Ke hoach chi tiet: `~/.claude/plans/c-i-thi-n-l-i-workflow-inherited-flame.md` (ban 6, sach sau 4 vong review ccf-spec-checker; disposition day du trong do). Nguoi dung chot: model opus ca 4 task, discipline off, chay khong diem lui (khong commit giua cac task), commit + push len main sau khi /ccf:cook xong.

## Task backlog — prompt-standard (in execution order)
| # | Slice | Layers | Gate (tests green) | Depends on | Status |
|---|-------|--------|--------------------|-----------|--------|
| 045 | Chuan viet + xuong song /ccf:plan + doi ky hieu nguyen khoi | 1 rule moi + 1 rule sua + 3 prompt viet lai + 3 file thay token + 4 README | grep baseline bang nhau + frontmatter assert + predicate status + md5 khoi v2 + khong sua assert + 227 test + 8 test template + tsc + validate + kiem song /ccf:plan (chua chay thi dung o in-review) | — | in-review |
| 046 | Xuong song implement + verify | 4 cmd/agent + 4 README | predicate implementerReportedTests + predicate status + parseIterations cho Origin + grep discipline-on 4 file + md5 v2 + kiem song /ccf:check; cook.md ghi UN-OBSERVED | 045 | in-review |
| 047 | Luong init + fix + 4 agent con lai | 2 cmd + 4 agent + 4 README | cau A4 nguyen van + AskUserQuestion init/fix + md5 v2 + kiem song hep: /ccf:fix toi cau hoi model, /ccf:init toi A4 dung | 046 | in-review |
| 048 | Chot phat hanh + ra drift + quet emoji sot | 3 file version + CLAUDE.md + doi chieu 9 ban v2 | version 3 noi + prose CLAUDE.md + md5 9 ban khop rule + quet codepoint toan cuc + git diff --stat trong tren 2 file test-gate-core + dem artifact | 047 | in-review |

> **UN-OBSERVED sau task 046 (ghi tuong minh, chap nhan boi nguoi dung):** ban viet lai cua
> `plugins/ccf/commands/cook.md` CHUA duoc chay mot luot nao. Khong co `/ccf:cook` nao thuc thi tren
> ban moi, vi chay het mot backlog qua dat; ca `check.md`, `updatespec.md` va `ccf-implementer.md`
> cung chay tu ban CACHE da cai chu khong tu repo nay, nen moi thay doi prompt o task 046 chi thanh
> hanh vi that sau khi cai lai plugin va mo phien moi. Dieu kien len `done` cua 046 la mot luot
> `/ccf:check` (di qua `check.md` + spawn `ccf-spec-checker`); rieng `cook.md` van o trang thai
> UN-OBSERVED sau khi 046 len `done`.

> Status: `todo` / `in-progress` / `in-review` / `done` / `blocked`. Lifecycle: `todo → in-progress → in-review → done` — `ccf-implementer` reaches `in-review`; only `/ccf:updatespec` writes `done` after `/ccf:check` + `/code-review` pass.
