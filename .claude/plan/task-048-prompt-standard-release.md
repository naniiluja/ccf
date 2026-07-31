# Task 048: Chot phat hanh + ra drift + quet emoji sot

Model: opus
Agent: ccf-implementer (1 phien moi). MCP: context7.
Depends on: 047
discipline: off

## Goal
1. Bump version 0.8.6 len 0.8.7 o dung 3 noi: `package.json`, `plugins/ccf/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`.
2. Sua drift prose trong `CLAUDE.md`: "12 call sites" theo so do that (grep lai), "as of v0.8.5" theo version moi, "the single largest per-session cost" cua hooks.md theo ket luan ground o 045 (paths: co lam @import lazy hay khong), ghi drift template co chu y (templates/**/*.tmpl chua theo chuan moi) kem cam ket iteration ke tiep, va cap nhat muc Current plan.
3. Doi chieu 9 ban khoi v2 voi rule `prompt-standard.md`: md5 khoang bullet khop, rule ton tai.
4. Quet codepoint toan cuc lan cuoi theo chinh sach trong rule.

## Rang buoc
- HAI file `plugins/ccf/templates/root/.claude/hooks/lib/test-gate-core.mjs` va `test-gate-core.test.mjs` nam NGOAI pham vi: khong doi byte nao (U+2716/U+2717 la du lieu logic cua FAIL_SIGNAL, mien tru ghi trong rule).
- Khong cham .claude/plan/ARCHIVE.md va archive/** (lich su verbatim).
- Khong sua assert test nao.

## Test viet truoc
1. Grep version: 3 file JSON cung 0.8.7; prose CLAUDE.md khong con chuoi version cu sai.
2. Quet 5 codepoint chan (U+1F52E, U+274C, U+2705, U+26A0, U+FE0F) = 0 tren `plugins/ccf/**` + `.claude/rules/*.md` + 4 README, tru mien tru; in tung vi tri truoc khi doi neu con sot.
3. Kiem cau truc: cay thu muc trong `plugins/ccf/README.md` giu nguyen so dong va 114 ky tu box-drawing.
4. `git diff --stat` TRONG tren 2 file test-gate-core (chay truoc khi commit; iteration khong commit giua chung nen phep nay chung minh ca 4 task khong cham chung).
5. 227 test + 8 test template + tsc + validate; dem artifact 6 cmd / 6 agent / 9 hook / 1 skill / 1 script khop README + CLAUDE.md; md5 9 ban v2 khop rule; toan bo grep baseline cua bang bat bien chay lai lan cuoi.

## Acceptance
Goal xong, moi test xanh, ghi chu task du. Sau task nay: chay chuoi verify cua /ccf:cook (review + code-review, simplify, re-gate, updatespec) roi commit + push len main theo lenh nguoi dung.

## Ghi chu thuc thi (task 048, phien ccf-implementer)

### Version bump: 3 file, khong sot noi nao
| File | Truoc | Sau |
| --- | --- | --- |
| `package.json` dong 3 | 0.8.6 | 0.8.7 |
| `plugins/ccf/.claude-plugin/plugin.json` dong 4 | 0.8.6 | 0.8.7 |
| `.claude-plugin/marketplace.json` dong 13 | 0.8.6 | 0.8.7 |

`grep -rn "0\.8\.6"` tren ca 3 file JSON + 4 README + `CLAUDE.md` → **0 ket qua** sau khi sua. Ca 3 file van `JSON.parse` duoc (kiem bang node). Ghi nhan: KHONG file nao khac trong repo nhac so version, nen bump chi dung 3 cho nhu rule `git-workflow.md` mo ta.

### `run_in_background`: so do that, va tai sao con so cu khong bao gio dung
Chuoi `12 call sites` KHONG nam trong `CLAUDE.md` nhu prompt task mo ta, no nam trong `.claude/rules/architecture.md:33`. Da sua tai dung noi no ton tai.

| Do luong | Lenh | Ket qua |
| --- | --- | --- |
| So dong chua literal | `grep -c 'run_in_background: false' plugins/ccf/commands/*.md` | **13** (plan 3, init 4, cook 3, check 1, fix 1, updatespec 1) |
| So lan literal xuat hien | `grep -o 'run_in_background: false' ... \| wc -l` | **13** (moi dong dung 1 lan) |
| So lan token xuat hien (moi dang) | `grep -o 'run_in_background' ... \| wc -l` | **17** |
| So dong chua token nhung KHONG chua literal | `grep -v` | **0** |

Trong 13 dong co literal, **12 la call site spawn that** va dong thu 13 (`cook.md:41`) la cau phat bieu chinh sach cho cac spawn ben duoi no ("every `Task` spawn below passes `run_in_background: false` explicitly"). Nen con so 12 khong sai ve ban chat, cai sai la no duoc cot vao mot lenh kiem chung tra ve 13: `grep -c run_in_background` dem DONG, va no dem ca cau chinh sach. Ban moi ghi ca hai con so cung lenh kiem chung dung, de lan sau nguoi doc khong phai chon giua chung.

### `@import` vs `paths:`: sua lai prose cho khop ket luan ground cua 045
`CLAUDE.md` dong 28 cu goi `hooks.md` la "candidate for `paths:`-scoping or splitting" — mau thuan truc tiep voi ket luan 045: `@import` nap vo dieu kien va VO HIEU HOA `paths:`. `hooks.md` co `paths: plugins/ccf/hooks/**` VA duoc `@import`, nen no van nap moi phien; them `paths:` khong mua duoc gi, chi co XOA dong `@import` moi lam scope co that.

Da tach dong 28 thanh hai invariant va do lai ngan sach SAU moi sua doi cua task nay:

| Do luong | Byte |
| --- | --- |
| Tong bo do (`wc -c CLAUDE.md .claude/rules/*.md`) | **108440** |
| `prompt-standard.md` (co `paths:`, KHONG `@import`) | 12517 |
| `hooks.md` (co `paths:`, NHUNG duoc `@import`) | 37760 |
| **Chi phi that moi phien** = tong tru file lazy duy nhat | **95923** |
| Gia dinh neu `paths:` cua `hooks.md` co hieu luc | 58163 |

Doi chieu voi cac ghi chu truoc: 045 ghi 55591, 046 do lai 55509. Ca hai deu do TRUOC khi task 048 lam `architecture.md` (11159 → 11690) va `prompt-standard.md` (11465 → 12517) day len, nen ca hai da bi thay the. Quan trong hon con so: hai ghi chu do goi 55509 la "bo VO DIEU KIEN", trong khi chinh 045 ket luan `hooks.md` nap vo dieu kien — tuc 55509 chua bao gio la so byte mot phien PHAI TRA. So dung la 95923. Da ghi ro trong `CLAUDE.md` dong 29 va `prompt-standard.md` dong 118 rang 58163 chi la gia dinh, khong duoc dem trich nhu chi phi that.

`prompt-standard.md` duoc ghi nhan tuong minh trong `CLAUDE.md` la file DUY NHAT lazy that: co `paths:`, co y khong `@import`, tim thay duoc qua duong dan tu `coding-conventions.md`, gop **0 byte** vao chi phi moi phien.

### 9 ban khoi v2: khop tuyet doi, do bang dung cach `sed | md5`
`grep -rln "^- Write in the SAME language" plugins/ccf .claude/rules` = **10 file** (9 prompt + 1 ban trong rule), dung con so ket-thuc-iteration ma rule chot.
Lenh do tung file: `s=$(grep -n "^- Write in the SAME language" f | cut -d: -f1); sed -n "${s},$((s+12))p" f | md5`.

| File | Dong bat dau | md5 | Byte |
| --- | --- | --- | --- |
| `.claude/rules/prompt-standard.md` | 44 | `deac0ef73d3c0cb9d26766027a906385` | 1479 |
| `plugins/ccf/commands/plan.md` | 15 | khop | 1479 |
| `plugins/ccf/commands/check.md` | 12 | khop | 1479 |
| `plugins/ccf/commands/cook.md` | 14 | khop | 1479 |
| `plugins/ccf/commands/init.md` | 14 | khop | 1479 |
| `plugins/ccf/commands/fix.md` | 12 | khop | 1479 |
| `plugins/ccf/commands/updatespec.md` | 17 | khop | 1479 |
| `plugins/ccf/agents/ccf-spec-checker.md` | 15 | khop | 1479 |
| `plugins/ccf/agents/ccf-spec-writer.md` | 15 | khop | 1479 |
| `plugins/ccf/agents/ccf-debugger.md` | 19 | khop | 1479 |

Con so trong rule (dong 39: "13 lines, 1479 bytes, `deac0ef...`") khop voi ca 10 ban. Khong ban nao phai sua trong task nay. Mau thuan em dash trong bullet 2 ma 045 de xuat xu ly o day: **KHONG sua**, vi sua thi phai dong loat 10 file va lam lech md5 da chot trong rule cung phien; hon nua khoi la source tieng Anh cua repo, khong phai van ban sinh ra cho nguoi dung. Neu muon sua thi phai la mot task rieng doi ca 10 ban + con so md5 trong rule cung luc.

### LOI THAT bat duoc: lenh quet codepoint trong rule co the PASS GIA
Lenh quet ghi trong `prompt-standard.md` dung `grep -rlP`. Trong phien nay shell tuong tac phan giai `grep` thanh mot wrapper ugrep (CO ho tro `-P`), nhung `/bin/sh -c` phan giai thanh `/usr/bin/grep` cua macOS (KHONG co `-P`): no exit 2, in usage ra stderr va de stdout RONG. Trong pipeline, stdout rong doc y het nhu "khong file nao khop" — tuc mot lenh quet an toan bao SACH trong khi no chua he quet. Da gap that khi chay script kiem chung qua `/bin/sh`.

Da sua bang cach them mot doan vao muc "Codepoint policy" cua rule: neu ro failure mode la PASS GIA, kem cach xac nhan cong cu (`grep -P '' /dev/null; echo $?` phai la 0) va 3 duong thay the (GNU `ggrep`, ripgrep, hoac mot node one-liner voi regex `/[\u{1F52E}\u{274C}\u{2705}\u{26A0}\u{FE0F}]/u`). Day la sua ngoai danh sach Goal, ly do: Goal 4 cua chinh task nay LA chay lenh quet do, va mot lenh quet co the bao sach gia thi khong dung lam gate duoc.

Chinh script kiem chung cua task nay vi vay quet bang node chu khong qua grep.

### Quet codepoint toan cuc lan cuoi
- Quet bang node tren **94 file** md/mjs/tmpl duoc git theo doi (loai `node_modules`, loai `.claude/plan/ARCHIVE.md` + `.claude/plan/archive/**`): **0 file** co codepoint bi chan.
- Dem tung codepoint tren `plugins/ccf/**` + `.claude/rules/*.md` + 3 README goc: U+1F52E **0**, U+274C **0**, U+2705 **0**, U+26A0 **0**, U+FE0F **0**.
- Mien tru con nguyen: `plugins/ccf/templates/root/.claude/hooks/lib/test-gate-core.mjs` van chua dung **2** ky tu U+2716/U+2717 trong `FAIL_SIGNAL`.

### Ra drift trong 4 README
| File:dong | Truoc | Sau |
| --- | --- | --- |
| `README.md:81` | "Three independent nudges" (A-C) | "Four independent clauses" + clause **(D)** archive-plan |
| `README.vi.md:81` | "Ba nudge doc lap" | "Bon clause doc lap" + clause (D) |
| `README.zh-CN.md:81` | "三个独立提示" | "四个独立子句" + clause (D) |
| `README.md:125` | "7 markdown prompts … init, plan, check, **test**, fix, updatespec, cook" | "6 markdown prompts … init, plan, check, fix, updatespec, cook" |
| `README.vi.md:125` | "7 file markdown prompt … test …" | 6, bo `test` |
| `README.zh-CN.md:125` | "7 个 … check、**test**、fix …" | 6, bo `test` |

Drift `README.md:125` la loai nang hon drift dem: no quang cao mot lenh `/ccf:test` **khong ton tai**. Ca 3 README doc gia deu mang no. Bang lenh trong cung file thi luon dung 6 row va khong co row `test`, nen chi doan Architecture bi lech.

Dem lai sau khi sua, moi con so lay tu file that:
- File that: `commands/*.md` = **6**, `agents/*.md` = **6**, `hooks/*.mjs` = **9**, `skills/*/` = **1**, `scripts/*.mjs` = **1**.
- Bang trong README: 6 row `/ccf:*`, 6 row `ccf-*`, 9 row hook — dung ca 3 ban ngon ngu.
- `CLAUDE.md` ghi "6 cmd / 6 agent / 9 hook / 1 skill / 1 script" — khop.
- `plugins/ccf/README.md` ghi "6 slash commands", "9 hooks", "1 human-run CLI" — khop, va file nay **khong bi cham** (72 dong / 6208 byte truoc va sau, giong nhau tung byte).

`wc -lc` 3 README goc: so DONG khong doi (140 moi file), byte tang do them clause (D): `README.md` 18837 → 19085, `README.vi.md` 20795 → 21097, `README.zh-CN.md` 18531 → 18783.

### Kiem cau truc cay thu muc
`plugins/ccf/README.md`: **72 dong**, **114** ky tu box-drawing (U+2500 den U+257F) — dung nhu baseline, vi file khong bi sua. Kiem bang node (`match(/[─-╿]/g).length`) chu khong bang grep, cung ly do PASS GIA o tren.

### `CLAUDE.md` sau khi sua
- `wc -lc` → **59 dong / 10633 byte**. Ca hai gate xanh: < 200 dong VA < 12288 byte (con du 1655 byte).
- Muc `## Current plan` viet lai hoan toan: bo cau "`PLAN.md` is EMPTY as of v0.8.5", thay bang iteration song 045-048 (ca 4 row `in-review`, khong row nao `done`), kem danh sach kiem SONG con thieu cua tung task va cau noi ro `cook.md` la mat xich yeu nhat (chua tung co `/ccf:cook` nao chay tren ban moi, nguoi dung chap nhan tuong minh).
- Ghi drift template co chu y: `plugins/ccf/templates/**/*.tmpl` CHUA len chuan prompt moi, kem ly do (template la khuon cho spec cua du an khac, nen du an sinh ra hom nay van thua tu ngu cu) va cam ket day la viec dau tien cua iteration ke tiep. Xac nhan bang do luong: `git status --porcelain -- plugins/ccf/templates` → **RONG**, tuc ca 4 task khong cham mot file template nao.
- `Standing debt` cua `hooks.md` giu lai nhung them canh bao: dung "sua" no bang `paths:`, vi frontmatter do vo nghia khi dong `@import` con do.

### Rang buoc pham vi: da kiem, khong vi pham
1. `git diff --stat -- plugins/ccf/templates/root/.claude/hooks/lib/test-gate-core.mjs plugins/ccf/templates/root/.claude/hooks/lib/test-gate-core.test.mjs` → **RONG**. Vi iteration chay khong commit giua chung, phep nay chung minh ca 4 task (045-048) khong cham 2 file do. `git status --porcelain -- plugins/ccf/templates` cung RONG, nen ca thu muc template con nguyen.
2. `git status --porcelain -- .claude/plan/ARCHIVE.md .claude/plan/archive` → **RONG**. Lich su verbatim khong bi sua.
3. Khong assert test nao bi sua: `git diff --stat` khong liet ke bat ky file `*.test.mjs` nao (25 file thay doi, khong file test nao trong danh sach).
4. File duy nhat ngoai danh sach Goal bi sua la `.claude/rules/prompt-standard.md` (2 cho: con so ngan sach da lac hau, va canh bao PASS GIA cua lenh quet) va `.claude/rules/architecture.md` (con so `run_in_background`). Ca ba deu la "ra drift" dung nghia Goal 2 va Goal 4, da neu ly do o tren.

### Ket qua test (chay that)
1. `node --test plugins/ccf/hooks/lib/*.test.mjs` → **227 pass, 0 fail** (553ms). Khong sua assert nao.
2. `node --test "plugins/ccf/templates/*/.claude/hooks/lib/*.test.mjs"` → **8 pass, 0 fail**.
3. `npx -p typescript tsc --noEmit` → **exit 0**.
4. `claude plugin validate plugins/ccf` → **Validation passed**, exit 0. Chay SAU version bump, vi `plugin.json` la file vua doi.
5. Script kiem chung acceptance (`scratchpad/verify-048.mjs`, 60 assertion) → **RED truoc khi sua: 25 pass / 30 fail**; **GREEN sau khi sua: 60 pass / 0 fail**. Bao gom: version 3 noi + khong con 0.8.6; 10 prose-assert tren `CLAUDE.md`; 2 gate kich thuoc `CLAUDE.md`; 12 assert drift README; quet codepoint bang node; 2 assert cau truc cay; 10 assert md5 khoi v2; `git diff` rong tren 2 file test-gate-core; `ARCHIVE.md` khong doi; dem artifact 6/6/9/1/1; row 048 la tu tran `in-review`.
6. Predicate tren `PLAN.md` THAT sau khi doi row 048 (goi dung chu ky: cac ham nhan DUONG DAN file, khong nhan mang dong — luot dau tien goi sai va tra `null`, da sua cach goi chu khong sua lib): `findActiveTask` → `{"id":"045",…}`; `findNonDoneTasks` → **4 row 045/046/047/048, tat ca `in-review`**; `findHintTask` → `{"id":"045",…}`; `findRetirableIterationsIn` → `[]` (dung: iteration chua dong het nen chua duoc archive).

### Con thieu de len `done` (cho ca 045-048)
Task nay khong tu tao ra khoang UN-OBSERVED moi, nhung no chot lai danh sach cua ca iteration, vi plugin thi hanh tu ban CACHE da cai chu khong tu repo:
- 045: mot luot `/ccf:plan` di tron buoc 0 → 1b → grill-me → 5 → 5b → 6 → `plan-review-gate`.
- 046: mot luot `/ccf:check` di qua buoc 1 den 6 + spawn `ccf-spec-checker`.
- 047: `/ccf:fix` chay toi cau hoi model qua `AskUserQuestion`; `/ccf:init` chay trong scratch dir toi A4.
- 048: khong co kiem song rieng; moi assert cua no la do luong tinh tren file va da xanh.
- `cook.md`: **UN-OBSERVED**, nguoi dung chap nhan tuong minh.
Buoc ke tiep theo Acceptance: chuoi verify cua `/ccf:cook` (review + `/code-review`, `simplify`, re-gate, `/ccf:updatespec`) roi commit + push len main theo lenh nguoi dung. Task nay KHONG commit.

### Ghi nhan sau batch-verify (vong chinh ghi, theo dinh nghia WARN moi)
- Batch-verify vong 1 tra 1 FAIL (cook.md thieu Bash trong allowed-tools trong khi buoc 5 goi npx/node/claude) + 6 WARN. Da sua ngay trong phien: them `Bash(npx:*), Bash(node:*), Bash(claude:*)` vao cook.md; ghi mien tru 4 file khong mang khoi v2 + sua o WARN + them dong `### Tests` + doan Tool-pairing vao prompt-standard.md; sua plugins/ccf/README.md:54 theo frontmatter that; them chi thi bare-word vao buoc 8 ccf-implementer.md. Vong 2 tra CLEAN, md5 10 ban v2 khong doi.
- WARN con lai, quyet dinh HOAN sang iteration sau (ghi de kiem duoc): pham vi Bash cua cook.md du cho repo nay (discipline off, test command la node --test) nhung CHUA du cho du an dich bat discipline: on voi runner ngoai bo npx/node/claude (npm, pnpm, yarn, pytest, go, cargo, phpunit, rspec, theo danh sach verify-trace.mjs:20). Huong sua khi lam: mo rong danh sach Bash prefix hoac dung Bash tran + permission prompt. Cung mach voi viec buoc 5 cook.md dang hardcode gate rieng cua repo nay (co san tu HEAD).
- /simplify duoc BO QUA co chu dich trong luot cook nay: goc khu-trung-lap cua no nham thang vao 10 ban khoi v2 von PHAI giong nhau tung byte (md5 gate), mot luot dedup thien chi se pha gate. Ghi lai thay vi chay roi do loi.

### Ghi nhan sau /ccf:check song dau tien (hau commit dc16fc5, plugin 0.8.7 da cai)
- FAIL duy nhat: 3 con so ngan sach loi thoi (108440/12517/95923/58163) vi cac ban sua sau review lam prompt-standard.md phinh them ma khong do lai, lan thu ba cung mot co che loi. Da sua ve diem bat dong: tong 110480, prompt-standard.md 14196, chi phi that moi phien 96284, gia dinh bo import hooks.md 58524. Luat moi ghi vao prompt-standard.md: do lai wc -c la BUOC CUOI cua moi task cham bo spec.
- WARN 1 (no dung, ghi lai): verify-chain.test.mjs khong assert token FAIL: nen hop dong ky hieu dau .mjs khong co chot tu dong; them mot assert.match(r, /FAIL:/) thuoc task moi vi iteration nay cam sua assert.
- WARN 2 (gop voi WARN Bash da hoan): check.md mang Bash khong gioi han trong khi cook.md bi bo vao 3 prefix, hai lenh cung chay test cua du an ngoai; khi giai quyet thi chon MOT chinh sach cho ca hai.
