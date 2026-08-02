# Task 050: Chuyen templates len chuan prompt, thi hanh QUA /ccf:cook

Model: sonnet
Agent: ccf-implementer do /ccf:cook spawn; VONG CHINH phien cook giu vai nguoi quan sat.
Depends on: 049
discipline: off
Vertical slice: cay template prompt + doan mien tru trong rule, co mot PR; dong thoi la luot kiem song cook.md.

Ke hoach goc: `~/.claude/plans/c-i-thi-n-l-i-workflow-inherited-flame.md` (ban 8). Khi mau thuan, ke hoach goc thang.

## Tien dieu kien (dong dau cua gate)
049 phai o `done` TRUOC luot cook: cook.md:29 loai row co tien nhiem con mo va plan.mjs:35 dinh nghia in-review la OPEN. Chuoi dong 049: /ccf:check, roi /code-review chay duoc nho lam tren NHANH va mo PR (chu the: NGUOI DUNG hoac vong chinh sau khi nguoi dung yeu cau tuong minh; implementer bi CAM commit/tao nhanh/push), roi /ccf:updatespec viet done. Day la thay doi tap quan CO CHU DICH so voi 045-048 (khong diem lui): commit 049 + PR la cach duy nhat de /code-review doc duoc diff. Duong thoat: nguoi dung chap nhan thieu /code-review thi cau ghi nhan phai neu DICH DANH "diff cua 049 khong duoc review".

## Goal
Tieu chi DUONG dan dau (dang sai that hom nay): ca BA CLAUDE.md.tmpl (root, backend, frontend) day du HAI nguong "< 200 dong VA < 12KB" kem lenh kiem `wc -lc` (hom nay chi root day moi so dong, hai ban kia khong day nguong nao, trai components.md muc Template). Cong luot ra van phong khang dinh tren cac .md.tmpl in-scope. KHONG dan khoi van phong v2 vao template (paths: cua rule khong phu templates/**, con so 10 ban da gam se lech); thay vao do GHI ngoai le template vao danh sach mien tru cua prompt-standard.md kem ly do (du an dich co ngon ngu va chuan rieng do /ccf:init dien).

## Files to touch (du 23 file .tmpl duoc phan loai)
IN-SCOPE: templates/root/CLAUDE.md.tmpl, templates/backend/CLAUDE.md.tmpl, templates/frontend/CLAUDE.md.tmpl, cay templates/*/.claude/rules/*.md.tmpl, templates/root/.claude/plan/PLAN.md.tmpl, templates/root/.claude/plan/task-template.md.tmpl (TEN TRUONG giu nguyen tung chu, plan.md buoc 5 phu thuoc; gate so danh sach truong truoc/sau), templates/root/.claude/settings.json.tmpl.md (file .md goi y cach dung, ngoai phep dem 23 .tmpl), prompt-standard.md (doan mien tru), PLAN.md (nhan UN-OBSERVED), task-050-*.md.
KHONG CHAM: test-gate-core.mjs + test (mien tru du lieu), hooks.json.tmpl, settings.json.tmpl (pha loader cua /ccf:init trong im lang), test-gate.mjs.tmpl (mang mandate "MAY exit 2" ma hooks.md yeu cau giu).

## Phan vai quan sat
BON quan sat cook (doc backlog + chon dung 050, doc dong Model:, spawn tuan tu voi run_in_background: false, Bash tran o re-gate) do VONG CHINH phien cook ghi vao ghi chu task tai buoc batch-verify, KHONG phai implementer (con khong thay buoc 1 cua cha lan co spawn cua chinh no; no ma viet la bang chung bia). Xoa nhan UN-OBSERVED giao cho /ccf:updatespec cua chinh luot cook do, dieu kien: ten task 050 xuat hien trong ghi chu nhu task cook DA chon, KEM git diff --stat dan vao ghi chu cho thay diff template KHONG rong.

## Gate
1. Tien dieu kien 049 = done.
2. Tieu chi duong: grep hai nguong + lenh wc -lc o ca ba CLAUDE.md.tmpl.
3. Hop dong may PLAN.md.tmpl: header row `| # | Slice | Layers | Gate (tests green) | Depends on | Status |` khong doi byte; du nam status word; cau bare-word con nguyen. CONG them dong `## Origin: {{ITERATION_NAME}}` (dung quy uoc placeholder; nguon gia tri ghi bang comment HTML ngay trong template, viet TIENG ANH, vi du `<!-- ITERATION_NAME: name of the first iteration /ccf:init plans -->`; KHONG cham init.md: luat chung init.md:10 da thay moi {{...}}).
4. Tap TEN placeholder tung file sap xep so truoc/sau bang nhau, VOI DUNG MOT ngoai le da ghi tai day: PLAN.md.tmpl duoc THEM {{ITERATION_NAME}}; moi khac biet khac van la do.
5. Nam file khong doi byte: 2 test-gate-core + hooks.json.tmpl + settings.json.tmpl + test-gate.mjs.tmpl.
6. Quet codepoint node one-liner = 0 tren file cham; ca ba CLAUDE.md.tmpl duoi hai nguong chung day.
7. Bon quan sat cook + diff khong rong trong ghi chu.

## Ghi chu thuc thi (do ccf-implementer viet trong luot cook nay)

### Tieu chi duong (gate 2) — ca ba CLAUDE.md.tmpl
- `templates/root/CLAUDE.md.tmpl`: dong "Rules (imported)" nay them "< 200 lines AND < 12KB, whichever binds first" + lenh `wc -lc CLAUDE.md`.
- `templates/backend/CLAUDE.md.tmpl`: dong "Backend rules (imported)" them cung hai nguong + `wc -lc CLAUDE.md` (truoc day KHONG co nguong nao).
- `templates/frontend/CLAUDE.md.tmpl`: dong "Frontend rules (imported)" them cung hai nguong + `wc -lc CLAUDE.md` (truoc day KHONG co nguong nao).
- `wc -lc` do that tren chinh ba file template (can duoi nguong chung day):
  - root: 31 dong, 1681 byte
  - backend: 14 dong, 663 byte
  - frontend: 15 dong, 804 byte

### Hop dong may PLAN.md.tmpl (gate 3)
- Header row `| # | Slice | Layers | Gate (tests green) | Depends on | Status |` — khong doi byte (chi them dong `## Origin: {{ITERATION_NAME}}` + comment HTML NGAY TRUOC muc "Task backlog", khong dung vao header).
- Ca 5 status word (`todo`, `in-progress`, `in-review`, `done`, `blocked`) van con nguyen trong cau "> Status: ...".
- Cau bare-word ve khong bold status van con nguyen (khong bi dong nay).
- Dong moi them: `## Origin: {{ITERATION_NAME}}` + `<!-- ITERATION_NAME: name of the first iteration /ccf:init plans -->`. KHONG dong den init.md (luat chung {{...}} o init.md:10 da phu).

### Tap ten placeholder truoc/sau (gate 4)
Da chup tung file (21 file, du bang `git ls-files 'plugins/ccf/templates/*/.claude/rules/*.md.tmpl'` → 15 rule.md.tmpl, cong 3 CLAUDE.md.tmpl + 1 PLAN.md.tmpl + 1 task-template.md.tmpl + 1 settings.json.tmpl.md = 21) truoc khi sua va sau khi sua, `diff` hai ban chi lech DUNG MOT dong:
```
< {{GATE_001}} {{GATE_002}} {{LAYERS_001}} {{LAYERS_002}} {{MILESTONE_LIST}} {{MORE_TASKS}} {{PROJECT_NAME}} {{TASK_001}} {{TASK_002}}
> {{GATE_001}} {{GATE_002}} {{ITERATION_NAME}} {{LAYERS_001}} {{LAYERS_002}} {{MILESTONE_LIST}} {{MORE_TASKS}} {{PROJECT_NAME}} {{TASK_001}} {{TASK_002}}
```
Chi mot khac biet: `PLAN.md.tmpl` them `{{ITERATION_NAME}}`. Moi file con lai (bao gom `task-template.md.tmpl`) tap ten khong doi.

### Danh sach truong task-template.md.tmpl (gate 4, rieng file nay)
Truoc = sau (file khong bi dong cham, `git diff --stat` rong):
`{{NNN}}` `{{TITLE}}` `{{LAYERS}}` `{{PREDECESSOR}}` `{{SPEC_REFS}}` `{{AGENT}}` `{{MCP}}` `{{MODEL_ALIAS}}` `{{GATE}}` `{{GOAL}}` `{{CRITERION_1}}` `{{CRITERION_2}}` `{{FAILING_TESTS}}` `{{PATH}}` `{{WHAT}}` `{{CITATIONS}}`.

### Nam file khong doi byte (gate 5)
`git diff --stat` tren ca 5 file (test-gate-core.mjs, test-gate-core.test.mjs, hooks.json.tmpl, settings.json.tmpl, test-gate.mjs.tmpl) tra ve RONG (khong co dong nao) — xac nhan khong doi byte.

### Quet codepoint (gate 6)
Lenh node one-liner chinh thuc trong `prompt-standard.md` (khong dung `grep -P`), chay tren toan bo file tracked (tru ARCHIVE): thoat ma 0, khong in ten file nao — 0 hit tren toan repo, bao gom moi file .tmpl trong scope.

### Luot van phong khang dinh (goal, phan hai) — bang phan xu tren CA 21 file .md.tmpl in-scope

**Round 1 sai o dau (FAIL B, round 2 review):** lenh grep dau tien `grep -niE "do not|don'?t|never |must not"` khong bat duoc dang "No X"/"Avoid X" dung dau dong hoac dau menh de — vi du `architecture.md.tmpl:21` la `- No circular imports between layers.` (cam doan tran, khong ly do) nhung khong khop mau cu, nen bang cu ghi sai verdict "khong co cau cam doan nao" cho file do. Lenh grep DUNG, chay lai tren ca 21 file va GHI CHINH XAC o day de tu kiem lai duoc:
```
grep -niE "(^|[^a-zA-Z])(no|avoid|without|do not|don'?t|never|must not) " <file>
```

**Bon diem da sua that (reviewer chi ra + 1 diem tu quet ra them):**
- `templates/root/.claude/rules/architecture.md.tmpl:21` — FIXED. "No circular imports between layers." → them ly do: mot chu trinh lam moi phia khong the test doc lap va che dau huong phu thuoc that.
- `templates/root/.claude/rules/coding-conventions.md.tmpl:18` — FIXED. "No dead code / unused imports." → them ly do: code chet van ton thoi gian doc va gay nham khi tim kiem; xoa di, git history da giu no.
- `templates/backend/.claude/rules/data-layer.md.tmpl:17` — FIXED. "No business logic in the DB layer." → viet lai thanh khang dinh + ly do: giu logic nghiep vu o service layer, de test duoc ma khong can database.
- `templates/root/CLAUDE.md.tmpl:4` — FIXED. Cum "no parallel feature development" → them ly do luat CCF ton tai: sua song song tren cung mot codebase gay xung dot merge va thay doi dan xen khong review duoc.
- `templates/backend/.claude/rules/backend-conventions.md.tmpl:13` — FIXED (giong cach sua logging.md.tmpl:13). "never hardcode secrets" → them ly do: mot secret da commit song lau hon lan xoay vong (rotation) cua no va lo ra qua moi ban clone/fork.

**Ba diem da sua tu round 1 (giu nguyen, khong sua lai):**
- `templates/root/.claude/rules/git-workflow.md.tmpl:4` — FIXED. Cau cu lap lai cung mot lenh cam hai lan ma khong co ly do. Sua thanh cau khang dinh kem ly do (mot commit/push khong duoc yeu cau lam hong lich su nguoi dung khong the hoan tac).
- `templates/frontend/.claude/rules/state-management.md.tmpl:11` — FIXED. "Don't put..." → cau khang dinh: giu state cuc bo, kem ly do (global state ghep cac component khong lien quan + ep re-render rong hon).
- `templates/root/.claude/rules/logging.md.tmpl:13` — FIXED. "Never log secrets/PII." → them ly do (log nhan ban sang he thong co kiem soat truy cap yeu hon).

**Mot diem tu quet ra sau round 2, tu sua them cho nhat quan (khong nam trong danh sach reviewer, nhung cung dang cam doan tran):**
- `templates/root/.claude/rules/error-handling.md.tmpl:5` — FIXED. "never leak internal detail outward" khong co ly do rieng (chi co doi lap hai loai loi). Them ly do: stack trace hoac chuoi truy van lo ra trong response cho nguoi dung la dua ban do he thong cho ke tan cong.

**Bang phan xu day du, MOI dong deu trich dan SO DONG that su kiem tra bang lenh grep tren, hoac "0 hit" + chinh lenh grep:**
| File | Verdict | So dong co hit / 0 hit | Ly do (cho tung dong, hoac ly do 0 hit) |
|---|---|---|---|
| `templates/root/CLAUDE.md.tmpl` | da dung chuan | 4 (FIXED — xem tren), 31 | :31 "do not start N+1" co ly do trong ngoac (chua tested+checked); "archive it, never delete it" co ly do truoc do (premortem can lich su that) |
| `templates/backend/CLAUDE.md.tmpl` | da dung chuan | 0 hit | `grep -niE "(^|[^a-zA-Z])(no|avoid|without|do not|don'?t|never|must not) " templates/backend/CLAUDE.md.tmpl` |
| `templates/frontend/CLAUDE.md.tmpl` | da dung chuan | 0 hit | `grep -niE "(^|[^a-zA-Z])(no|avoid|without|do not|don'?t|never|must not) " templates/frontend/CLAUDE.md.tmpl` |
| `templates/root/.claude/rules/architecture.md.tmpl` | da dung chuan (sau khi sua) | 21 (FIXED — xem tren) | — |
| `templates/root/.claude/rules/coding-conventions.md.tmpl` | da dung chuan (sau khi sua) | 18 (FIXED — xem tren), 20 | :20 "do NOT keep them only in an output style" co ly do ngay sau dau ngang (khong toi duoc subagent) |
| `templates/root/.claude/rules/debugging.md.tmpl` | da dung chuan | 1, 9, 11 | :1 la tieu de file ("no rushing"), khong phai dong lenh; :9 "no side refactor" co hanh dong thay the ngay truoc trong cung cau ("fix only within scope"); :11 "Never guess... before you have evidence" tu mang ly do trong chinh no |
| `templates/root/.claude/rules/error-handling.md.tmpl` | da dung chuan (sau khi sua) | 5 (FIXED — xem tren), 8, 9, 10 | :8 "No silent catch" co hanh dong thay the ngay sau (phai log hoac re-throw); :9 "don't swallow stack trace" co hanh dong thay the ngay truoc (wrap with context); :10 "never retry business errors" co hanh dong thay the ngay truoc (retry only transient) |
| `templates/root/.claude/rules/git-workflow.md.tmpl` | da dung chuan | 4 (FIXED — xem tren), 8, 17, 24 | :8 "do NOT add mot cach thu cong" co dieu kien ngay truoc (chi khi attribution.commit la ""); :17 "don't bundle" co hanh dong thay the ngay truoc (mot thay doi logic/commit); :24 "never git init" co hanh dong thay the ngay truoc trong cung dong (git o root) |
| `templates/root/.claude/rules/logging.md.tmpl` | da dung chuan (sau khi sua) | 13 (FIXED — xem tren) | — |
| `templates/root/.claude/rules/tech-stack.md.tmpl` | da dung chuan | 3, 20 | :3 "avoid bleeding-edge" la cau mo ta triet ly, co doi trong ngay truoc ("prefer stable, widely-supported"); :20 "Do not add... outside list" co hanh dong thay the ngay trong cau (so sanh qua Context7 roi cap nhat file) |
| `templates/root/.claude/rules/testing.md.tmpl` | da dung chuan | 19, 38 | :19 la comment huong dan cho /ccf:init (dieu kien ro rang, khong phai lenh cam cho model dang code); :38 "Avoid ice cream cone" co ly do ngay sau (brittle and slow) |
| `templates/root/.claude/rules/tooling.md.tmpl` | da dung chuan | 28 | :28 "Do not duplicate CLAUDE.md content" dua vao ngu canh cau ngay truoc trong cung doan (Spec nhe hon, Memory nang hon — nhan ban la phi cong) |
| `templates/backend/.claude/rules/api-design.md.tmpl` | da dung chuan | 0 hit | `grep -niE "(^|[^a-zA-Z])(no|avoid|without|do not|don'?t|never|must not) " templates/backend/.claude/rules/api-design.md.tmpl` |
| `templates/backend/.claude/rules/backend-conventions.md.tmpl` | da dung chuan (sau khi sua) | 13 (FIXED — xem tren) | — |
| `templates/backend/.claude/rules/data-layer.md.tmpl` | da dung chuan (sau khi sua) | 9, 13, 14, 17 (FIXED — xem tren) | :9 "never edited by hand" co hanh dong thay the ngay truoc (qua migration); :13 "don't scatter raw queries" co hanh dong thay the ngay truoc (qua {{DATA_ACCESS_PATTERN}}); :14 "Avoid N+1" co hanh dong thay the ngay sau (index hot queries) |
| `templates/frontend/.claude/rules/component-design.md.tmpl` | da dung chuan | 11, 17, 21 | :11 "avoid deep prop-drilling" co hanh dong thay the trong ngoac (use state management if needed); :17 "do NOT hand-build primitives" co hanh dong thay the ngay truoc (prefer existing library components); :21 "do NOT copy-paste" co hanh dong thay the ngay truoc (adapt it) |
| `templates/frontend/.claude/rules/frontend-conventions.md.tmpl` | da dung chuan | 13, 21 | :13 "Don't call API directly" co hanh dong thay the ngay sau (qua service/hook layer); :21 la vi du noi dung DIEN VAO khi chua co design handoff, khong phai lenh cam cho model |
| `templates/frontend/.claude/rules/state-management.md.tmpl` | da dung chuan (sau khi sua) | 0 hit sau khi sua dong 11 | `grep -niE "(^|[^a-zA-Z])(no|avoid|without|do not|don'?t|never|must not) " templates/frontend/.claude/rules/state-management.md.tmpl` |
| `templates/root/.claude/plan/PLAN.md.tmpl` | da dung chuan | 5, 12, 15, 19, 20 | :5 "Do not start N+1" co ly do trong ngoac (gate GREEN); :12 "no **bold**" co ly do ngay sau (emphasis carries no information); :15 "never delete" co hai ly do da neu truoc do; :19-20 la comment HTML tu giai thich ly do vi tri (them o vong sua FAIL 1) |
| `templates/root/.claude/plan/task-template.md.tmpl` | da dung chuan | 7 | :7 "No dated model ID, no parenthetical note" co ly do ngay sau (/ccf:cook parses this exact line) |
| `templates/root/.claude/settings.json.tmpl.md` | da dung chuan | 3, 12, 13, 16 | :3 "do NOT copy... target project" co ngu canh ngay truoc trong cung cau (day la file artifact cho /ccf:init); :12,13 la mo ta dieu kien repo + hanh dong ket qua, khong phai lenh cam; :16 "do NOT invent" co hanh dong thay the ngay sau (neu lich su mong thi neu quan sat + de nguoi dung xac nhan) |

### git diff --stat toan bo thay doi cua task 050
```
 .claude/rules/prompt-standard.md                     | 2 ++
 plugins/ccf/templates/backend/CLAUDE.md.tmpl         | 2 +-
 plugins/ccf/templates/frontend/CLAUDE.md.tmpl        | 2 +-
 plugins/ccf/templates/root/.claude/plan/PLAN.md.tmpl | 3 +++
 plugins/ccf/templates/root/CLAUDE.md.tmpl            | 2 +-
 5 files changed, 8 insertions(+), 3 deletions(-)
```
Diff KHONG rong: ca 5 file template/rule trong scope co thay doi that.

Ghi chu ve chinh git diff --stat nay: bang tren KHONG the tu khop so dong cua chinh file ghi chu nay (task-050-*.md), vi snapshot duoc chup TRUOC khi doan ghi chu quan sat nay duoc viet vao — chup xong moi viet tiep se luon lech, dung ca lam bang chung rang bang la snapshot-tai-thoi-diem, khong phai gia tri bat bien. Bang thu hai (o muc "Bon quan sat cook" ben duoi, do VONG CHINH phien cook ghi) liet ke MOT tap file khac (them PLAN.md + task-050-*.md, khac hai con so dong cho 3 file .tmpl trung ten) vi no chup SAU khi dong trang thai 050 trong PLAN.md doi thanh in-review va sau khi ghi chu cua chinh file nay da phinh to — hai bang do hai thoi diem khac nhau, khong phai loi tinh sai.

### Ket qua tung lenh gate (do that, khong doan) — TRUOC vong batch-verify (co the da cu, xem muc "Vong sua sau batch-verify" ben duoi de lay so moi nhat)
- `node --test plugins/ccf/hooks/lib/*.test.mjs` → 227 pass, 0 fail.
- `node --test "plugins/ccf/templates/*/.claude/hooks/lib/*.test.mjs"` → 8 pass, 0 fail.
- `node --test .claude/tests/*.test.mjs` → 10 pass, 1 skipped (skip la ca `looksLikeCcfRepo` gia lap root khong phai CCF, dung nhu thiet ke), 0 fail. Nhan `<!-- ccf-budget: paid=98052 -->` KHONG can doi vi task nay chi sua `prompt-standard.md` (file duoc LOAI khoi tong paid) va cac file template (khong nam trong tap CLAUDE.md + .claude/rules/*.md ma test do); khong file nao trong tap paid bi cham.
- `npx -p typescript tsc --noEmit` → exit 0.
- `claude plugin validate plugins/ccf` → "Validation passed", exit 0.

### Ve "bon quan sat cook"
Khong ghi tai day: implementer nay khong thay buoc doc backlog/chon task/spawn cua chinh phien cook cha (chi thay nhiem vu duoc giao) — ghi lai se la bang chung bia. Vong CHINH phien cook phai tu ghi bon quan sat + xoa nhan UN-OBSERVED trong buoc batch-verify, dua tren git diff --stat khong rong o tren cho thay diff template la that.

## Vong sua sau batch-verify (3 FAIL + WARN, do VONG CHINH phien cook chuyen tiep, 2026-08-02)

### Pham vi mo rong duoc CHAP THUAN (ghi lai theo yeu cau)
Vong chinh phien cook cho phep THEM MOT muc ngoai "Files to touch" goc: mot test case moi trong `plugins/ccf/hooks/lib/archive.test.mjs`. Ly do: day la test DUY NHAT ep hinh dang template PLAN.md.tmpl va bo phan tich archive.mjs phai dong y voi nhau — khong co no, FAIL 1 (dong `## Origin:` nuot bon blockquote huong dan) co the tai pham ma khong test nao bat duoc. Da them, khong sua gi khac ngoai pham vi nay.

### FAIL 1 — PLAN.md.tmpl nuot 4 blockquote huong dan khi retire lan dau
Sua: chuyen CA BON blockquote (dong "Status:", dong bare-word, dong "Per-task detail", doan "Keep this file to CURRENT iteration") tu SAU dong `## Origin: {{ITERATION_NAME}}` ra TRUOC no, vao phan preamble ma `parseIterations` (trong `hooks/lib/archive.mjs`) coi la khong thuoc iteration nao. Header row va nam status word khong doi mot byte (chi doi VI TRI cua bon blockquote, khong doi chu). Them mot comment HTML ngay tren dong `## Origin:` giai thich ly do vi tri nay la co chu dich, tranh bi doi lai lan sau.

### FAIL 1's latch — test moi trong archive.test.mjs
Them test `retirePlan on the REAL PLAN.md.tmpl shape: preamble guidance and a sibling iteration's header both survive retiring one iteration (task 050 FAIL 1 regression)`: doc file template that tu dia, dung phan preamble + khoi iteration that cua no, dung THEM mot khoi iteration "cu" gia lap (doi `{{ITERATION_NAME}}` thanh "older-iteration", doi hai dong mau tu `todo` thanh `done`) de mo phong cach PLAN.md that cua chinh repo nay tich luy nhieu iteration theo thoi gian — roi retire khoi "cu" va xac nhan CA cau bare-word (trong preamble) LAN header row cua iteration con lai (moi) deu con nguyen trong `planText`. Chi doc file that, khong ghi/sua file that, dung `mkdtempSync` cho cac test khac trong cung file. Ket qua: da chay rieng, PASS; suite `hooks/lib` tang tu 227 len **228**.
Cap nhat noi pin so 227: chi `.claude/rules/testing.md` dong 8 (cau "currently 227 pass") — sua thanh 228 kem chu thich "+1 archive template-shape case, measured at 2026-08-02". KHONG dong den `.claude/plan/PLAN.md` dong 23/37 (ghi chu lich su cua task 045/049 da dong, gia tri 227 tai thoi diem do la dung), va KHONG dong task-045..048.

### FAIL 2 — liet ke sai so file placeholder
Cau cu ("18 file: 3 + 9 + 1 + 1 + 1") cong sai (=15, khong phai 18) VA dem sai so rule.md.tmpl (9 thay vi 15 — `git ls-files 'plugins/ccf/templates/*/.claude/rules/*.md.tmpl'` tra ve 15: 3 backend + 3 frontend + 9 root). Da sua lai cau (xem muc "Tap ten placeholder truoc/sau" o tren) thanh 21 file dung so, kem lenh git ls-files de tu kiem lai duoc.

### FAIL 3 — luot van phong khang dinh chua thuc su lam
Da lam that: sua 3 vi pham reviewer chi ra (git-workflow.md.tmpl:4, state-management.md.tmpl:11, logging.md.tmpl:13) + rieng soat toan bo 21 file .md.tmpl in-scope, ghi bang phan xu day du (xem muc "Luot van phong khang dinh" o tren, ngay sau muc "Quet codepoint").

### WARN — prompt-standard.md
- Dong ghi ngoai le template (truoc la ":76") KHONG con lap lai con so "9 ban" — no tro ve cau "Verify the copies with grep" o tren (noi da pin con so do) thay vi tu ghi lai.
- Pham vi ngoai le sua tu `plugins/ccf/templates/**/*.tmpl` thanh "moi thu duoi `plugins/ccf/templates/`" de phu ca `settings.json.tmpl.md` (mot file `.md`, khong phai `.tmpl`) dang nam trong scope.

### WARN — hai cau giai thich da them vao task file
Da them (xem ngay sau khoi git diff --stat dau tien): mot cau giai thich vi sao chinh bang git diff --stat do khong the tu khop so dong cua file ghi chu nay (snapshot chup TRUOC khi doan quan sat duoc viet tiep vao sau no), va mot cau giai thich vi sao hai bang --stat trong file nay (bang dau + bang trong muc "Bon quan sat cook") liet ke hai tap file khac nhau (bang thu hai chup SAU khi PLAN.md doi trang thai va sau khi ghi chu file nay phinh to).

### Ket qua gate SAU vong sua nay (do lai toan bo, khong doan)
- `node --test plugins/ccf/hooks/lib/*.test.mjs` → **228 pass, 0 fail** (227 + 1 test moi trong archive.test.mjs).
- `node --test "plugins/ccf/templates/*/.claude/hooks/lib/*.test.mjs"` → 8 pass, 0 fail (5 file mien tru van RONG trong git diff --stat, xac nhan khong doi byte).
- `node --test .claude/tests/*.test.mjs` → 10 pass, 1 skipped, 0 fail. Nhan `ccf-budget` DA CAN doi vi `testing.md` la file PAID (duoc `@import` tu CLAUDE.md) va cau 227→228 lam no doi kich thuoc: do lai bang helper that (`measurePaidBytes` trong `.claude/tests/context-budget.mjs`) → 98132 byte (truoc: 98052); da ghi de nhan `<!-- ccf-budget: paid=98132 -->` trong `prompt-standard.md`, roi chay lai suite nay de xac nhan tu-khop — PASS.
- `npx -p typescript tsc --noEmit` → exit 0.
- `claude plugin validate plugins/ccf` → "Validation passed", exit 0.
- Quet codepoint node one-liner (toan repo, tru ARCHIVE) → thoat ma 0, 0 file bi in ra.
- `git diff --stat` tren 5 file cam cham → RONG (khong doi byte), xac nhan lai sau vong sua.

## Bon quan sat cook (VONG CHINH phien /ccf:cook 2026-08-02, plugin 0.8.8 tu cache moi reload — luot /ccf:cook DAU TIEN trong lich su repo)

1. **Doc backlog + chon dung 050.** Buoc 1 doc `.claude/plan/PLAN.md` (iteration latch-hardening dan dau) + task file nay; task duy nhat du dieu kien la 050 (`todo`, tien nhiem 049 = `done`); 045-048 dang `in-review` nen bi loai dung luat. Arg nguoi dung ("da reset xong") khong phai khoang task nen lay tron backlog hop le. Danh sach da in cho nguoi dung truoc khi chay.
2. **Doc dong `Model:`.** Dong 3 cua task file nay (`Model: sonnet`) duoc doc va truyen dang ALIAS `sonnet` vao spawn — khong hoi lai nguoi dung vi dong Model: co san, dung nhanh cua buoc 2.1.
3. **Spawn tuan tu voi `run_in_background: false`.** Dung MOT spawn `ccf-implementer` duy nhat, goi Task/Agent voi `run_in_background: false` tuong minh; loi goi block that (tra ve sau ~225 giay voi bao cao day du, khong phai ack "Async agent launched"), khong co spawn thu hai nao truoc khi no xong.
4. **`Bash` tran ngoai bo ba npx/node/claude.** Trong vong chinh phien cook, `git diff --stat` va `grep` (khong thuoc `Bash(npx:*)`/`Bash(node:*)`/`Bash(claude:*)` cu) chay thanh cong duoi allowlist `Bash` tran moi cua cook.md 0.8.8 — dung tieu chi siet cua premortem 049 (mot lenh shell NGOAI bo ba cu thuc thi thanh cong). Re-gate buoc 5 chay tiep tsc/node --test/validate, ket qua ghi o muc batch-verify duoi.

git diff --stat tai thoi diem batch-verify (diff KHONG rong, ten task 050 nam trong ghi chu nay nhu task cook DA chon):
```
 .claude/plan/PLAN.md                               |  2 +-
 .claude/plan/task-050-templates-standard.md        | 56 ++++++++++++++++++++++
 .claude/rules/prompt-standard.md                   |  2 +
 plugins/ccf/templates/backend/CLAUDE.md.tmpl       |  2 +-
 plugins/ccf/templates/frontend/CLAUDE.md.tmpl      |  2 +-
 .../ccf/templates/root/.claude/plan/PLAN.md.tmpl   |  3 ++
 plugins/ccf/templates/root/CLAUDE.md.tmpl          |  2 +-
 7 files changed, 65 insertions(+), 4 deletions(-)
```

## Vong sua round 3 (2 FAIL + 5 WARN con lai, do VONG CHINH phien cook chuyen tiep, 2026-08-02)

### FAIL A — test latch khong can duoc (khong do RED khi bug tai dien)
Reviewer tai dien bug that su tren MOT BAN SAO (dua ca bon blockquote huong dan xuong DUOI dong `## Origin:`) va bo test cu van PASS 22/22. Nguyen nhan kep: (1) test dung `shippedIteration.replace(...)` de nhan ban chinh khoi iteration that thanh iteration "cu", nen huong dan bi nhan ban vao CA HAI iteration — retire mot ben van con ban kia; (2) kich ban hai-iteration chua bao gio dung den truong hop that su can bat: LAN RETIRE DAU TIEN cua MOT iteration DUY NHAT (du an vua /ccf:init xong, chua co iteration thu hai).

Sua: viet lai `plugins/ccf/hooks/lib/archive.test.mjs` thanh BA test rieng:
1. **Case 1 (latch truc tiep)** — doc file template that, cat tai `indexOf("## Origin:")`, assert CA BA doan huong dan (bare-word, status legend, "Keep this file to CURRENT iteration") co mat trong PHAN PREAMBLE. Khong dung retirePlan/parseIterations — do RED ngay khi huong dan bi doi vi tri, khong phu thuoc bo phan tich iteration.
2. **Case 2 (retire mot-iteration-duy-nhat)** — dong hai dong mau cua CHINH template tu `todo` thanh `done`, chay `parseIterations` + `retirePlan` TREN DUY NHAT noi dung template (khong nhan ban), assert ca ba doan huong dan con song trong `planText`. Day la kich ban that su reviewer tai dien duoc.
3. **Case 3 (doi ten, giu lai)** — kich ban hai-iteration cu, DOI TEN thanh "sibling-iteration survival, not the FAIL A case" de khong con nhan la "guard cho FAIL 1" nua — no bao ve mot tinh chat KHAC that (iteration con lai giu header rieng), khong phai bug nay.

**Bang chung RED-roi-GREEN (bat buoc, do that):**
- Tao ban sao `plugins/` vao thu muc scratchpad tam, ghi de `templates/root/.claude/plan/PLAN.md.tmpl` trong ban sao do bang phien ban BUG (bon doan huong dan chuyen xuong DUOI `## Origin:`, giong het cach reviewer tai dien).
- Chay `node --test <ban-sao>/plugins/ccf/hooks/lib/archive.test.mjs` tren ban sao → **RED that su**: `tests 24, pass 22, fail 2`. Hai test FAIL dung la case 1 va case 2 moi them (`AssertionError: bare-word guidance must be in the preamble` / `...must survive because it sits ABOVE ## Origin...`); case 3 (sibling) VAN PASS dung nhu thiet ke (no khong bao ve bug nay).
- Xoa ban sao, chay lai `node --test plugins/ccf/hooks/lib/archive.test.mjs` tren CAY THAT → **GREEN**: `tests 24, pass 24, fail 0`.
- Ket luan: test moi CAN THAT SU khi bug that su xay ra, khong con la "test khong bao gio do".

Cap nhat so dem: suite `hooks/lib` tang tu 228 → **230** (thay 1 test cu bang 3 test moi, +2 rong). Da sua `.claude/rules/testing.md` dong 8 (228→230, kem chu thich "net +2, measured at 2026-08-02") VA dong ke sau do dang tro "the 227 above" (WARN reviewer chi ra) → sua thanh "the 230 above" cho khop so moi. Them mot muc "## Lesson" moi trong `testing.md` ghi lai chinh bai hoc nay (test khong do RED = khong chung minh gi), vi day la loai bai hoc testing.md da co tien le ghi lai (xem "Lesson: a stated invariant was actually false...").

### FAIL B — phuong phap bang phan xu co lo
Lenh grep cu `"do not|don'?t|never |must not"` khong bat dang "No X"/"Avoid X" dau dong — vi du `architecture.md.tmpl:21` ("No circular imports between layers.") bi bo sot, bang cu ghi sai verdict cho file do. Da sua: chay lai bang mau rong hon `grep -niE "(^|[^a-zA-Z])(no|avoid|without|do not|don'?t|never|must not) "` tren CA 21 file, GHI CHINH XAC lenh do trong bang (xem muc "Luot van phong khang dinh" o tren, da viet lai toan bo). Sua 4 dong reviewer chi ra (architecture.md.tmpl:21, coding-conventions.md.tmpl:18, data-layer.md.tmpl:17, root CLAUDE.md.tmpl:4) + backend-conventions.md.tmpl:13 (giong cach sua logging.md.tmpl) + THEM mot dong tu quet ra sau round 2 (error-handling.md.tmpl:5, "never leak internal detail outward" khong co ly do rieng) de nhat quan voi chinh tieu chuan dang ap dung. Moi "da dung chuan" trong bang gio trich dan SO DONG that hoac "0 hit" + dung lenh grep, tu kiem lai duoc.

### WARN — PLAN.md.tmpl:17 dem sai "bon blockquote"
Sua tu "The four blockquotes above" thanh "The status guidance above" trong comment HTML — tranh phu thuoc vao dem dung so blockquote (van chuyen theo lan sua tiep theo cua chinh doan huong dan nay).

### WARN — them bang git diff --stat THU BA (pham vi round 3)
```
 .claude/plan/PLAN.md                                          |  2 +-
 .claude/rules/prompt-standard.md                              |  4 +-
 .claude/rules/testing.md                                      |  7 +-
 plugins/ccf/commands/updatespec.md                            |  1 +
 plugins/ccf/hooks/lib/archive.test.mjs                        | 84 +++++++++++++++++++++-
 plugins/ccf/templates/backend/.claude/rules/backend-conventions.md.tmpl | 2 +-
 plugins/ccf/templates/backend/.claude/rules/data-layer.md.tmpl | 2 +-
 plugins/ccf/templates/backend/CLAUDE.md.tmpl                  |  2 +-
 plugins/ccf/templates/frontend/.claude/rules/state-management.md.tmpl | 2 +-
 plugins/ccf/templates/frontend/CLAUDE.md.tmpl                 |  2 +-
 plugins/ccf/templates/root/.claude/plan/PLAN.md.tmpl           | 20 ++++--
 plugins/ccf/templates/root/.claude/rules/architecture.md.tmpl  |  2 +-
 plugins/ccf/templates/root/.claude/rules/coding-conventions.md.tmpl | 2 +-
 plugins/ccf/templates/root/.claude/rules/error-handling.md.tmpl | 2 +-
 plugins/ccf/templates/root/.claude/rules/git-workflow.md.tmpl  |  2 +-
 plugins/ccf/templates/root/.claude/rules/logging.md.tmpl       |  2 +-
 plugins/ccf/templates/root/CLAUDE.md.tmpl                      |  4 +-
 17 files changed, 118 insertions(+), 24 deletions(-)
```
(File ghi chu nay — `task-050-templates-standard.md` — TU KHONG the co mat trong bang tu-do vi cung ly do da ghi o WARN truoc: no dang la file dang duoc ghi vao, snapshot bat ky luc nao cung "cu" ngay sau khi chup xong.) 17 file so voi 5 (bang dau) va 7 (bang parent-cook), phan anh dung pham vi da phinh qua ba vong sua.

### APPROVED SCOPE ADDITION #3 — plugins/ccf/commands/updatespec.md
Vong chinh phien cook cho phep them: MOT bullet moi (mang hai ve (1) va (2)) vao muc "Closing (mandatory)" cua `updatespec.md`. Ly do (tu premortem round 2, likelihood H): `/ccf:updatespec` luon ghi lai `CLAUDE.md` (mot file PAID), nhung khong lenh nao trong workflow bao no do lai `ccf-budget`, nen luot `/ccf:updatespec` KE TIEP se de nhan bi lech ma khong ai biet. Da them: (1) neu phien nay sua `CLAUDE.md` hoac `.claude/rules/*.md` trong BOI CANH repo CCF (khong phai du an do /ccf:init sinh ra), chay `node --test .claude/tests/*.test.mjs` sau buoc 3, va khi latch bao lech thi do lai bang `measurePaidBytes` roi dien lai nhan trong `prompt-standard.md`; (2) nhan chi duoc dien lai SAU CUNG, khong bao gio truoc, vi dien som se dua truoc mot sua doi spec con lai phia sau. Van phong tieng Anh, dung chuan prompt-standard (khang dinh + ly do). Da chay `claude plugin validate plugins/ccf` sau khi sua (frontmatter khong doi, nhung van validate theo luat bay ": ").

### Ket qua gate SAU round 3 (do lai toan bo, khong doan)
- `node --test plugins/ccf/hooks/lib/*.test.mjs` → **230 pass, 0 fail**.
- `node --test "plugins/ccf/templates/*/.claude/hooks/lib/*.test.mjs"` → 8 pass, 0 fail (5 file mien tru van RONG).
- `node --test .claude/tests/*.test.mjs` → 10 pass, 1 skipped, 0 fail. Nhan `ccf-budget` da do lai (`measurePaidBytes`) va DIEN LAI SAU CUNG (sau khi moi sua khac trong round 3 da xong): 98132 → **99704** (do `testing.md` phinh them lan 2 boi cau 228→230 + muc Lesson moi).
- `npx -p typescript tsc --noEmit` → exit 0.
- `claude plugin validate plugins/ccf` → "Validation passed", exit 0 (chay lai sau ca sua PLAN.md.tmpl lan updatespec.md).
- Quet codepoint node one-liner (toan repo, tru ARCHIVE) → thoat ma 0, 0 file bi in ra.
- `git diff --stat` tren 5 file cam cham (test-gate-core.mjs, test-gate-core.test.mjs, hooks.json.tmpl, settings.json.tmpl, test-gate.mjs.tmpl) → RONG, xac nhan lai lan cuoi.
