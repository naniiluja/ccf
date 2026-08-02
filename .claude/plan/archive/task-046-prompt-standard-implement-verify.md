# Task 046: Xuong song implement + verify

Model: opus
Agent: ccf-implementer (1 phien moi). MCP: context7.
Depends on: 045
discipline: off

## Goal
Viet lai theo checklist 14 muc cua `.claude/rules/prompt-standard.md` (nguon chuan tu 045): `plugins/ccf/commands/cook.md`, `plugins/ccf/commands/check.md`, `plugins/ccf/commands/updatespec.md`, `plugins/ccf/agents/ccf-implementer.md`. Dan khoi v2 (tu rule, khong tu task file) vao check.md, cook.md, updatespec.md. Moi thay doi mang tinh LUONG phai kem trich dan tai lieu trong ghi chu task; khong trich dan duoc thi giu nguyen luong. Cap nhat 4 README cho description doi. Luu y: 045 da cham cook.md (thay token ky hieu dong 40/53) va verify-chain.mjs + hooks.md; doc ghi chu 045 truoc khi sua tiep.

## Bat bien phai giu (grep baseline truoc/sau + predicate)
- Dong `TEST-RESULT:` trong ccf-implementer.md: neo dau dong, la dong cuoi cua Return format, giu ca dang `TEST-RESULT: n/a (no test surface)` (regex hook: `/^\s*TEST-RESULT:\s*\S/m`).
- Cau "NOT `done`" cua ccf-implementer.md (lifecycle: implementer chi len in-review): giu nghia va do manh, chot ban nguyen van moi.
- Bo tu vung status chu tran + cau bare-word trong updatespec.md; heading `## Origin` trong updatespec.md buoc 6 (archive.mjs parse).
- Token `discipline: on` du 4 file (plan.md, ccf-spec-checker.md tu 045; ccf-implementer.md, cook.md o task nay): grep nguyen van ca 4 o cuoi task.
- `AskUserQuestion` trong allowed-tools cook.md; dong `Model:` cook.md van parse dung dinh dang buoc 5 plan.md.
- `run_in_background: false` tai moi call site cua 4 file (baseline truoc/sau bang nhau).
- So hieu buoc cook.md (1b/6) duoc goi tu tooling.md:38,41 va init.md; khong danh so lai hoac sua dong thoi + assert file dich.
- Khong sua assert nao trong test; khong cham verify-chain.mjs nua (045 da doi chuoi); khong cham 2 file test-gate-core.

## Test viet truoc
1. Predicate: node one-liner goi implementerReportedTests (hooks/lib/implementer-verify.mjs) tren final-message dung theo khoi Return-format MOI cua ccf-implementer.md, ky vong true; tren cau hua giua chung, ky vong false.
2. Predicate: findActiveTask/findNonDoneTasks tren PLAN.md tong hop viet theo huong dan moi cua updatespec.md (thu muc tam); parseIterations/findRetirableIterations (hooks/lib/archive.mjs, nhan lines) tren mau co `## Origin`.
3. Grep ky hieu cu = 0 tren 4 file; md5 khoi bullet 3 ban dan khop md5 trong rule.
4. 227 test + 8 test template + tsc + validate nhu 045.
5. Frontmatter assert 4 file.
6. Ngan sach wc truoc/sau.

## Acceptance
Goal xong, test xanh, ghi chu task du (thay doi luong + trich dan, dong da cat, cau nguyen van moi). Kiem song: chay `/ccf:check` mot luot tren repo (di qua check.md + spawn ccf-spec-checker) la dieu kien len done. cook.md khong duoc luot nao chay: ghi UN-OBSERVED tuong minh vao PLAN.md (chap nhan thay vi chay /ccf:cook vi dat).

## Ghi chu thuc thi (task 046, phien ccf-implementer)

### Baseline do TRUOC lan sua dau tien, va so lai SAU
| Do luong | Truoc | Sau |
| --- | --- | --- |
| `run_in_background` (dong/lan) cook.md | 3 / 3 | 3 / 3 |
| `run_in_background` (dong/lan) check.md | 1 / 1 | 1 / 1 |
| `run_in_background` (dong/lan) updatespec.md | 1 / 1 | 1 / 1 |
| `run_in_background` ccf-implementer.md | 0 | 0 |
| Tong bare-token tren 6 lenh (baseline 045: 18) | 18 | 18 |
| Codepoint bi chan tren 4 file dich | 0 | 0 |
| Quet codepoint toan repo (tru ARCHIVE.md + archive/**) | 0 file | 0 file |
| `wc -lc` cook.md | 71 / 11738 | 88 / 13386 |
| `wc -lc` check.md | 33 / 3601 | 54 / 6670 |
| `wc -lc` updatespec.md | 70 / 9886 | 76 / 10571 |
| `wc -lc` ccf-implementer.md | 39 / 4045 | 51 / 5315 |
| `wc -c CLAUDE.md .claude/rules/*.md` (tong) | 104734 | 104734 |

Ngan sach context KHONG doi: task 046 khong sua file rule nao, nen bo vo dieu kien (tong tru `hooks.md` 37760 va `prompt-standard.md` 11465) van la **55509 byte**. Ghi chu 045 chep so 55591; do lai bang chinh lenh do 045 neu ra thi la 55509, chenh 82 byte, nen lay so do-lai nay lam moc cho task 048.

### md5 khoi v2: 5 ban khop, va luu y ve cach do
- `sed -n '<start>,<start+12>p' <file> | md5` (co ky tu newline cuoi) = **`deac0ef73d3c0cb9d26766027a906385`**, 1479 byte, tren ca 5 ban: `prompt-standard.md:44`, `plan.md:15`, `check.md:12`, `updatespec.md:17`, `cook.md:14`, `ccf-spec-checker.md:15`.
- Neu do bang cach `join("\n")` KHONG co newline cuoi thi ra `0671baedd69d609e383b6556c550300a`, 1478 byte. Hai con so nay la CUNG mot khoi, chi khac newline cuoi. Task 048 phai dung dung cach `sed | md5` de doi chieu voi con so trong rule.
- 3 ban duoc dan trong task nay khong duoc go tay: mot script node cat dung dong 44-56 cua `.claude/rules/prompt-standard.md` roi thay cho o giu cho `@@STYLE_BLOCK@@`, nen byte-identical la ket qua co san chu khong phai do go trung.
- Con 2 ban v1 (`init.md`, `ccf-spec-writer.md`) thuoc task 047. Tong ban v2 hien tai: 5 tren 9.

### Thay doi luong (flow) kem trich dan
1. **`check.md` THEM buoc `## 0a. Style for user-facing text`** (khoi v2 + dong `Scope boundary:` rieng cho bao cao review). Day la hanh vi MOI: bao cao gio phai viet bang ngon ngu cua nguoi dung. Trich dan: `.claude/rules/prompt-standard.md` muc "Canonical style block for user-facing text" ("Every command or agent that emits text a human reads carries this block") va muc "What may differ between copies" (heading co so cho lenh, dong Scope boundary rieng tung file). Cung ly do cho `cook.md` va `updatespec.md`.
2. **`check.md` buoc 6 doi bo heading bao cao** tu `Conforms / Violations (with file:line) / Spec drift / Recommended fixes` sang bo 4 heading chinh tac `### Conforms` / `### Violations` / `### Should-reconsider` / `### Tests`, moi dong mang dau `PASS:` / `FAIL:` / `WARN:`, va relay nguyen ven `### Premortem` neu checker tra ve. Trich dan: `.claude/rules/prompt-standard.md` muc "Review marker vocabulary" ("Both ends of this vocabulary must move together") + `ccf-spec-checker.md` Return format (ben SAN XUAT, da doi o task 045). `Spec drift` khong con la heading rieng, nghia "spec drift" nam trong noi dung dong `WARN:` — dung cach 045 da lam voi `ccf-spec-checker.md`.
3. **`check.md` buoc 2 doi cach xac dinh mode khi `$ARGUMENTS` rong**: tu "ask or infer from the most recent changes" thanh "infer tu diff cua buoc 4, noi ro mot dong mode nao duoc chon, va chi hoi bang van xuoi khi diff that su nhap nhang". Ly do la mot cai bay da co san: than lenh noi "ask" trong khi `allowed-tools` KHONG co `AskUserQuestion`. Trich dan: `.claude/rules/components.md` muc AskUserQuestion pairing, noi ghi ro `check.md` va `updatespec.md` CO Y khong mang tool nay. Huong sua o day khong phai them tool (rule da chot quyet dinh) ma la bo chu "ask" mo ho, vi mot cau hoi bang van xuoi thi khong can tool.
4. **`cook.md` buoc 3 THEM token `discipline: on`** vao dieu kien nhan biet test discipline (truoc day chi noi ten khoi trong `testing.md`). Khong doi hanh vi, chi lam token tro nen grep duoc o ca 4 file. Trich dan: `plan.md` buoc 5b ghi `discipline: on` vao task file; `ccf-implementer.md` buoc 4 va `ccf-spec-checker.md` muc 6 doc token do — `cook.md` la mat xich thu tu trong cung chuoi.
5. **`ccf-implementer.md` THEM muc `## Scope discipline (the anti-over-engineering block)`** (5 bullet, co ly do va hanh vi thay the). Trich dan: `prompt-standard.md` checklist muc 10 ("`ccf-implementer` carries an explicit anti-over-engineering block ... the only agent that writes files"). Hai bullet cu ("Only do the assigned task", "Do NOT refactor on the side") duoc gop vao khoi nay chu khong bi mat.
6. **`ccf-implementer.md` Return format doi hinh thuc trinh bay**: hai dang `TEST-RESULT:` nay nam trong hai the `<example>` rieng thay vi hai bullet. Trich dan: `prompt-standard.md` checklist muc 5 (the XML khi mot doan tron chi dan voi vi du). Chuoi duoc hook doc KHONG doi: predicate `implementerReportedTests` van true tren ca hai dang, false tren cau hua giua chung.
7. Grounding phien nay: mot luot Context7 `/websites/code_claude` (`/en/sub-agents`, `/en/cli-reference`, `/en/agent-sdk/subagents`) xac nhan lai hinh dang prompt cua subagent (mo dau bang vai + prompt neu ro tieu chi va dinh dang dau ra, dung nhu checklist muc 6). Luot nay KHONG tra ve huong dan ve the XML, nen checklist muc 5 va 8 giu nguyen trich dan tu task 045 (platform.claude.com prompt-engineering) chu khong nhan them nguon moi. Ghi dung nhu vay de khong ke cong mot trich dan khong ton tai.
8. KHONG doi luong nao khac. Cu the giu nguyen: so hieu buoc `cook.md` (1b, 2.3, 3, 4, 5, 6, 7, 8 — `tooling.md:38` goi buoc 6, `tooling.md:41` goi buoc 1b, `tooling.md:37` goi buoc 4), so hieu buoc `check.md` 1-6 va ten muc `## Closing (mandatory)` (`tooling.md:50` goi "check.md closing"), so hieu buoc `updatespec.md` 1-6 va cau truc 3 buoc con cua muc retire.

### Danh sach dong da cat (khong con ban thay the)
- `check.md` dong 8: cum ngoac `(Anthropic recommends a clean-context reviewer for sharper review)` → viet thanh cau thuong, bo ngoac; cum `You only review — you do NOT modify code.` → thanh cau khang dinh noi ro viec sua thuoc ai.
- `check.md` buoc 6: heading `Spec drift` (khong con doc lap) va cum `Recommended fixes` (gop thanh "suggested fix" trong tung dong `FAIL:`); cau `Do NOT fix anything.` → thanh "Recommend the fixes and leave them to the next implementer task; this command edits nothing."
- `check.md` buoc 2: chu `ask or` truoc `infer` (xem thay doi luong 3).
- `updatespec.md`: cum `(rules derivable from code or belonging to the repo)` → gop vao cau; cum `Do NOT put in memory:` → `Keep out of memory ...`; cum `(you may delegate drafting to ccf-spec-writer ...)` tu trong ngoac → thanh cau rieng; cum `**Do NOT run any git command unless the user explicitly agrees.**` → `run a git command only after they explicitly agree`; cum `Do NOT auto-write it and do NOT auto-commit.` → `Leave the writing to them, since it changes how every future commit in the repo is attributed.`; cum `narrative` trong "any narrative rule here" → `prose`.
- `updatespec.md` muc retire buoc 1: cum `do not do steps 1–2 by hand` → `rather than editing the two files by hand` (bo tham chieu so buoc tu tro nguoc, vi no de sai khi danh so lai); buoc 3 `Do NOT commit.` → `Leave committing to the user.`
- `cook.md`: cum `— without the user re-invoking each step by hand` giu nghia nhung het la ngoac kep dau gach; cum `(they don't touch files, so this is safe unlike the writer loop above)` → viet vao than cau; cum `**OPTIONAL secondary stop condition:**` bo chu hoa OPTIONAL; cum `it's a different mechanism entirely` → `a different mechanism from (a)'s numeric cap`; cum `do not conflate the two mechanisms` → `so do not reason from one to the other`; nhan `**"≤3 agents" cap**` doi thanh `**cap of 3 agents**` (ky tu U+2264 duoc phep nhung o day la nhan khong phai bieu thuc, viet chu de mot lenh grep tim duoc).
- `ccf-implementer.md`: bullet `**Only do the assigned task.** Don't touch other tasks.` va bullet `**Do NOT refactor on the side** beyond what's needed for the task.` → gop vao muc Scope discipline; dong `## Return` doi ten thanh `## Return format`; cum `Summary: files changed, tests written + actual run results ...` → cau day du neu ro thu tu bao cao.
- Khong dong nao mang thong tin bi bo hoan toan: moi dong bien mat trong diff deu co ban viet lai tuong duong hoac duoc gop vao mot dong khac trong cung file.

### Ban NGUYEN VAN cau "NOT `done`" moi (`ccf-implementer.md` buoc 8)
> 8. Update the task's status in `.claude/plan/PLAN.md` to `in-review`, NOT `done`. The task is code-and-test complete but UNREVIEWED. `done` is written only by `/ccf:updatespec`, after `/ccf:check` and `/code-review` pass, and never by you.

Ban cu de doi chieu do manh: "Update the task status in `.claude/plan/PLAN.md` to `in-review` (NOT `done`). The task is code+test complete but UNREVIEWED. `done` is set ONLY by `/ccf:updatespec`, after `/ccf:check` + `/code-review` pass — never by the implementer." Cung ba menh de, cung mot lenh cam, chi bo dau gach ngang va noi ro "never by you" thay cho "never by the implementer".

### Ket qua test (chay that)
1. Predicate tier-B (8 case, script tam `predicates.mjs`, chay TRUOC lan sua dau va lai SAU) → **8 pass, 0 fail** ca hai luot:
   - `implementerReportedTests` tren final-message viet theo khoi Return-format MOI (co dong `TEST-RESULT: node --test ... → 227 passed, 0 failed`) → `true`; tren dang `TEST-RESULT: n/a (no test surface)` → `true`; tren cau hua giua chung "I will add a TEST-RESULT: line later ..." → `false`.
   - `findActiveTask` tren PLAN.md tong hop (thu muc tam, status tu tran theo dung huong dan `updatespec.md` buoc 6) → `{"id":"046","title":"Implement + verify surfaces"}`; `findNonDoneTasks` → `["046","047"]` (row `done` bi loai).
   - `parseIterations` tren lines co `## Origin` → 1 iteration; `findRetirableIterations` → 0 khi con row mo, 1 khi moi row da `done`.
   - Chay lai tren PLAN.md THAT sau khi sua: `findRetirableIterationsIn` → `[]`, `findNonDoneTasks` → `045:in-review, 046:in-review, 047:todo, 048:todo`. Blockquote UN-OBSERVED moi them khong lam vo parse.
2. `node --test plugins/ccf/hooks/lib/*.test.mjs` → **227 pass, 0 fail** (581ms). Khong sua bat ky assert nao.
3. `node --test "plugins/ccf/templates/*/.claude/hooks/lib/*.test.mjs"` → **8 pass, 0 fail**. `git diff --stat` tren 2 file `test-gate-core*` → RONG (khong cham).
4. `npx -p typescript tsc --noEmit` → **exit 0**.
5. `claude plugin validate plugins/ccf` → **Validation passed** (exit 0). Chay sau moi lan viet lai, vi day la gate DUY NHAT bat duoc loi YAML `": "` ma 045 dinh phai.
6. Frontmatter assert + vi tri (18 case, node one-liner) → **18 pass, 0 fail**: du field o ca 4 file; khong field frontmatter nao chua `": "`; hai dong `TEST-RESULT:` nam trong muc cuoi cung `## Return format` cua `ccf-implementer.md`.
7. `git diff -U0 | grep '^[+-](description|name|model|effort|allowed-tools|disallowedTools|argument-hint):'` → **rong**. Khong mot dong frontmatter nao doi, ke ca description.
8. `git diff --stat plugins/ccf/hooks/lib/verify-chain.mjs` → chi 3 dong cua task 045 (doi chuoi hien thi sang `FAIL:`), task 046 khong cham file nay.

### 4 README: khong can sua, va ly do
Khong description nao doi (test 7 o tren), nen khong co gi de dong bo. Da kiem them: `grep -n 'Spec drift\|Recommended fixes\|Conforms\|Violations\|Should-reconsider'` tren `README.md`, `README.vi.md`, `README.zh-CN.md`, `plugins/ccf/README.md` → **0 ket qua**, tuc khong README nao trich bo heading bao cao cua `check.md`; quet codepoint bi chan tren 4 README → **0**. Cac dong lien quan (`README.md:52/54/55/67`, `plugins/ccf/README.md:17`) chi DIEN GIAI chu khong trich nguyen van, va van dung sau khi viet lai.

### Ra drift phat hien nhung KHONG sua o task nay (de `/ccf:check` va task 048 xu ly)
`README.md:81` viet `updatespec-nudge` co "Three independent nudges" trong khi hook da co BON clause (A den D, clause D la archive-plan). Day la drift co san, khong do task 046 gay ra, va sua README dem so thuoc pham vi task 048 — theo dung ky luat scope, chi bao cao chu khong tu mo rong.

### Con thieu de len `done`
- Kiem SONG chua chay: mot luot `/ccf:check` di qua `check.md` (buoc 1 den 6 + spawn `ccf-spec-checker`) tren chinh repo nay.
- `cook.md`: **UN-OBSERVED**, chap nhan boi nguoi dung (chay het mot backlog qua dat). Da ghi tuong minh vao `PLAN.md`.
- Plugin chay tu ban CACHE da cai chu khong tu repo, nen ca 4 file viet lai o task nay chi thanh hanh vi that sau khi cai lai plugin va mo phien moi.

### Kiem song da chay (2026-07-31, plugin 0.8.7 tu cache moi)
Mot luot /ccf:check that da chay tron luong moi: check.md ban viet lai dieu khien phien chinh (khoi 0a, chon mode mot dong, uy quyen ccf-spec-checker voi run_in_background: false), agent tra bao cao dung dinh dang moi (### Conforms/Violations/Should-reconsider/Premortem/Tests voi PASS:/FAIL:/WARN:), hai dau hop dong ky hieu khop nhau ngoai doi. Dieu kien kiem song cua task 046 DA dat; cook.md van UN-OBSERVED nhu da ghi.
