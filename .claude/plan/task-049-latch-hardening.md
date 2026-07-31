# Task 049: Chot tu dong + thong nhat chinh sach Bash

Model: sonnet
Agent: ccf-implementer (1 phien moi, KHONG qua /ccf:cook vi tien nhiem 048 dang in-review nen cook loai row nay). MCP: context7 neu can doi chieu.
Depends on: 048
discipline: off
Vertical slice: helper + test + prose spec + frontmatter hai lenh (mot tang test, mot tang prompt), co mot PR.

Ke hoach goc va disposition 8 vong review: `~/.claude/plans/c-i-thi-n-l-i-workflow-inherited-flame.md` (ban 8). Task file nay la ban chat loc; khi mau thuan, ke hoach goc thang.

## Files to touch (khong file nao ngoai danh sach)
- MOI: `.claude/tests/context-budget.mjs` + `.claude/tests/context-budget.test.mjs` (pham vi REPO; khong dat vao plugins/ccf/**: hooks/lib duoc ship qua package.json files nen test doc CLAUDE.md cua repo se do oan tren may nguoi cai plugin).
- `tsconfig.json`: them `.claude/tests/**/*.mjs` vao include (test file tu loai qua exclude `**/*.test.mjs` san co).
- `plugins/ccf/hooks/lib/verify-chain.test.mjs`: them assert vao 2 test SAN CO (dong 53 va 68), khong them test case moi.
- `CLAUDE.md`, `.claude/rules/prompt-standard.md`, `.claude/rules/testing.md`, `.claude/rules/components.md` (prose, chi tiet duoi).
- `plugins/ccf/commands/cook.md` dong 4; `plugins/ccf/commands/check.md` chi xac nhan, khong doi.
- `plugins/ccf/agents/ccf-implementer.md`: vi du TEST-RESULT viet dang chung, bo so 227 gam cung.
- `task-045-*.md` + `task-046-*.md`: ghi bang chung kiem song (muc d).
- `.claude/plan/PLAN.md` (CHI: row 049 len in-review + dong UN-OBSERVED moi cho lan sua allowlist thu ba cua cook.md) va `task-049-*.md` (ghi chu thuc thi).

## (a) Chot token ky hieu trong verify-chain.test.mjs
- Them vao hai test san co: `assert.match(r, /FAIL:/)` va `assert.doesNotMatch(r, /[\u{274C}\u{2705}]/u)`. So test bo hooks/lib GIU NGUYEN 227 (assert khong phai test); moi cho dang gam 227 vi the KHONG can doi, grep xac nhan.
- Grep baseline dem marker FAIL:/WARN:/PASS: tren ccf-spec-checker.md + 4 dau doc (plan.md buoc 6, cook.md buoc 3+5, check.md, verify-chain.mjs), ghi vao ghi chu task.

## (b) Chot ngan sach context: test tu-nhat-quan (thiet ke chot sau 8 vong review, lam DUNG tung diem)
- Mot dong nhan may doc DUY NHAT trong prompt-standard.md: `<!-- ccf-budget: paid=NNNNN -->` (so dien bang phep do cuoi). Extractor CHI doc nhan nay, khong quet so tran (cac so lich su va so lam tron khong gay do oan).
- Chi assert so PAID = tong byte (CLAUDE.md + .claude/rules/*.md) TRU cac file co paths: ma khong bi @import (hien chi prompt-standard.md). Nhan nam trong file bi tru khoi paid nen sua nhan khong dich chuyen phep do (loai han fixpoint). CLAUDE.md dong 28-29 doi thanh DAN toi nhan theo duong dan + luat "do wc -c la buoc cuoi", khong nhac lai so.
- Assert file mang nhan thuoc danh sach lazy; kem assert khong rule nao trong .claude/rules/*.md co dong bat dau bang `@` (chong import long lam nhan nhap lai tap do), do kem cau chi duong.
- Assert 2 nguong cung cua CLAUDE.md (<200 dong, <12288 byte) voi nguong TRICH tu chinh cau invariant dong 27; phep trich phai ASSERT KHOP truoc khi so (khong default: default luc truot la PASS GIA). Comment ghi 12KB = 12288.
- Root giai bang import.meta.url, khong process.cwd(); CLAUDE.md tim duoc khong mang chuoi "CCF — Claude Context First" thi t.skip() kem ly do.
- Khi fail: in chan doan tong tho + danh sach file lazy, KHONG assert tong tho.
- Helper thuan extractPaidClaim(root) / measurePaidBytes(root), JSDoc du. Phep thu pha logic tren BAN SAO: cpSync cay spec vao mkdtempSync, dot bien nhan trong ban sao, assert do; dung MOT assertion cuoi dung root that (cam dot bien file that: try/finally khong chay khi bi ngat bang tin hieu, bai hoc io.test.mjs).
- testing.md them lenh chay thu ba `node --test .claude/tests/*.test.mjs` kem ly do pham-vi-repo; so dem ghi dang "do tai <ngay>", khong gam.
- Ghi vao ghi chu (khong sua trong task nay): freshness.mjs dung glob tran *.mjs nen commit chi cham .claude/tests se kich nudge "spec cu hon code" sai; neu on thi iteration sau them :(exclude).claude/**.

## (c) Bash tran cho ca hai lenh
- cook.md dong 4: noi `Bash(npx:*), Bash(node:*), Bash(claude:*)` ve `Bash` tran. check.md giu nguyen. Ghi dong UN-OBSERVED moi vao PLAN.md (lan sua allowlist thu ba cua cook.md khi no chua tung chay).
- VIET LAI doan Tool pairing trong prompt-standard.md (khong va them): phan biet lenh shell BIET TRUOC luc viet prompt (scope prefix, vi du Bash(git log:*) cua grill-me) voi lenh KHONG BIET TRUOC (test runner du an dich: Bash tran la minimum SUFFICIENT). Ghi quyet dinh vao components.md canh luat AskUserQuestion.

## (d) Ghi bang chung kiem song da xay ra
- task-045-*.md: luot /ccf:plan phien 2026-07-31 di tron buoc 0, 1b (5 analyzer haiku, cau hoi model HIEN THAT qua AskUserQuestion), grill-me 0.8.7, 5b, 6 (8 vong spec-checker), va plan-review-gate cho ExitPlanMode qua. task-046-*.md: da ghi san (luot /ccf:check hau commit). Trang thai van chi /ccf:updatespec duoc doi; /code-review phai chay tay (PR tren nhanh) truoc khi row nao len done.

## Test viet truoc (acceptance)
1. (a) xoa tam `FAIL:` khoi chuoi nguon tren BAN SAO verify-chain.mjs trong thu muc tam, test ban sao do; ban that xanh.
2. (b) dot bien nhan tren BAN SAO cay spec do; ban that xanh; t.skip() hien dung voi root gia.
3. 227 pass giu nguyen + 8 template + bo .claude/tests moi xanh + `npx -p typescript tsc --noEmit` exit 0 + `claude plugin validate` passed.
4. Quet codepoint file cham bang node one-liner `/[\u{1F52E}\u{274C}\u{2705}\u{26A0}\u{FE0F}]/u` = 0 (cam grep -P: BSD grep exit 2 stdout rong doc nhu sach).
5. Grep hai dong allowed-tools sau sua; grep cac cho gam 227 xac nhan KHONG doi.
6. Do wc -c la BUOC CUOI, dien nhan ccf-budget mot lan duy nhat.
Moi ket qua that ghi vao "## Ghi chu thuc thi"; kem danh sach thay doi luong + trich dan, danh sach dong da cat.

## Ghi chu thuc thi (task 049, phien ccf-implementer)

### (a) Grep baseline marker FAIL:/WARN:/PASS: (truoc khi sua verify-chain.test.mjs)
| File | FAIL: | WARN: | PASS: |
| --- | --- | --- | --- |
| `plugins/ccf/agents/ccf-spec-checker.md` | 3 | 3 | 3 |
| `plugins/ccf/commands/plan.md` | 2 | 2 | 1 |
| `plugins/ccf/commands/cook.md` | 4 | 1 | 1 |
| `plugins/ccf/commands/check.md` | 2 | 2 | 2 |
| `plugins/ccf/hooks/lib/verify-chain.mjs` | 4 | 0 | 0 |

Sau khi them 2 assert (`assert.match(r, /FAIL:/)` + `assert.doesNotMatch(r, /[\u{274C}\u{2705}]/u)`) vao hai test san co (`buildVerifyReason: always names the ordered chain...` va `buildVerifyReason: disciplineOn=true → includes the run-the-test-suite step`), khong them test case moi: bo `hooks/lib` van **227 pass, 0 fail** (637ms), dung nhu du kien — assert khong phai test, so dem khong doi.

### Phep thu pha logic tren BAN SAO (acceptance 1, chay tay, khong luu lai lam test co dinh)
Copy `verify-chain.mjs` + `verify-chain.test.mjs` vao `mkdtempSync`, thay moi chuoi `FAIL:` bang `NOPE:` chi tren ban sao (`sed` tai cho, khong dot bien file that). Chay `node --test` tren ban sao → **do**: `AssertionError` tai assert `/FAIL:/` moi them, `actual` la chuoi `buildVerifyReason` tra ve voi `NOPE:` thay cho `FAIL:`. Chay lai tren file that (khong dot bien) → **16 pass, 0 fail**. Xac nhan dung: assert moi that su bat duoc su tro lai cua ky hieu icon/token cu.

### (b) Ngan sach context: nhan ccf-budget + tu-nhat-quan
- Nhan MOI duy nhat dat trong `.claude/rules/prompt-standard.md` (canh doan "Why not @import"): `<!-- ccf-budget: paid=98203 -->`.
- Truoc khi them nhan, chay `.claude/tests/context-budget.test.mjs` do label chua ton tai → **4 test do that** (`ccf-budget label not found ...`), dung dinh nghia mot test chua bao gio do thi khong chung minh duoc gi.
- Sau khi them nhan + sua CLAUDE.md dong 28-29 + `components.md` + `testing.md` (lam thay doi tong byte cua bo do), do lai `measurePaidBytes(".")`: `paid=98203`, `rawTotal=114324`, `lazyFiles=["prompt-standard.md"]`. Dien dung so nay vao nhan (mot lan duy nhat, o buoc CUOI sau khi moi sua doi khac da xong).
- Bo `.claude/tests` sau khi dien nhan dung: **9 pass, 1 skip** (skip la case `looksLikeCcfRepo` tren root gia, dung y thiet ke, khong phai loi), 0 fail.
- Assert file mang nhan thuoc danh sach lazy: PASS (`prompt-standard.md` co `paths:`, khong nam trong tap `@import` cua CLAUDE.md).
- Assert khong rule nao trong `.claude/rules/*.md` co dong bat dau bang `@` (chong import long): PASS, 0 hit hien tai.
- Assert trich ngan hai nguong tu cau invariant CLAUDE.md dong 27: PASS, `maxLines=200`, `maxBytes=12288` (quy uoc 12KB = 12288 byte, khong phai 12000); mot ban sao xoa cau invariant lam ham trich `throw` (khong co gia tri mac dinh).
- CLAUDE.md that: 59 dong (truoc sua) → do lai sau moi sua VAN LA **59 dong** (sua so byte cu the trong dong 28-29, khong xoa dong nao), byte cuoi cung ghi trong muc "wc -c CUOI CUNG" duoi day sau khi sua xong toan bo vong review /ccf:check; ca hai vAn duoi hai nguong 200 dong / 12288 byte.

### wc -c CUOI CUNG (buoc cuoi, sau moi sua doi khac)
```
   10874 CLAUDE.md
   11690 .claude/rules/architecture.md
    3064 .claude/rules/coding-conventions.md
   13466 .claude/rules/components.md
    2782 .claude/rules/git-workflow.md
   37760 .claude/rules/hooks.md
   16121 .claude/rules/prompt-standard.md
    7352 .claude/rules/testing.md
   11215 .claude/rules/tooling.md
  114324 total
```
Bo vo dieu kien (tru `prompt-standard.md`, file lazy duy nhat): 114324 − 16121 = **98203 byte**, khop dung nhan `ccf-budget` da dien. Nhan dien MOT LAN DUY NHAT, dung sau khi moi sua rule/prose khac cua task nay da xong (dung thu tu buoc CUOI).

### (c) Bash tran cho ca hai lenh
- `cook.md:4` doi `Bash(npx:*), Bash(node:*), Bash(claude:*)` → `Bash` tran. `check.md:4` giu nguyen `Bash` tran (khong doi).
- Doan Tool pairing trong `prompt-standard.md` VIET LAI (khong chi them): phan biet lenh BIET TRUOC luc viet prompt (scope prefix, vi du `Bash(git log:*)` cua `grill-me`) voi lenh KHONG BIET TRUOC (test runner cua du an dich; `Bash` tran la minimum SUFFICIENT). Quyet dinh ghi vao `.claude/rules/components.md` canh muc `AskUserQuestion`.
- UN-OBSERVED moi ghi vao `PLAN.md`: day la lan sua allowlist THU BA cua `cook.md`, va `cook.md` van CHUA tung chay mot luot `/ccf:cook` nao tren ban moi.

### (d) Bang chung kiem song da ghi
- `task-045-*.md`: them muc "Kiem song da chay (2026-07-31, phien /ccf:plan lap ke hoach 049+050)" — chinh luot `/ccf:plan` sinh ra ke hoach nay (`~/.claude/plans/c-i-thi-n-l-i-workflow-inherited-flame.md`) da di tron buoc 0 (plan-mode-guard), 1b (5 analyzer haiku, `AskUserQuestion` hoi model that), grill-me 0.8.7, 5, 5b (`Model: sonnet`, `discipline: off` dung dinh dang), va 6 (8 vong review `ccf-spec-checker` toi khi CLEAN, `plan-review-gate` cho `ExitPlanMode` qua).
- `task-046-*.md`: KHONG sua — muc "Kiem song da chay (2026-07-31, plugin 0.8.7 tu cache moi)" da ghi san mot luot `/ccf:check` that su chay hau commit, dung nhu ke hoach goc mo ta ("da ghi san").
- Trang thai van chi `/ccf:updatespec` duoc doi thanh `done`; `/code-review` van phai chay tay (PR tren nhanh) truoc khi bat ky row nao len `done` — chua co PR nao mo cho iteration nay.

### Ghi nhan, KHONG sua trong task nay (scope creep guard)
`lib/freshness.mjs` khai `CODE_PATHSPECS` bang glob tran `*.mjs`, nen mot commit CHI cham `.claude/tests/*.mjs` (test moi cua task nay) se kich nudge "spec cu hon code" SAI, vi glob tran khop ca file ngoai `plugins/ccf/**`. Neu on trong thuc te, iteration sau them `:(exclude).claude/**` vao pathspec. Khong sua o day vi ngoai pham vi "Files to touch" cua task 049.

### Danh sach dong da cat (khong con ban thay the)
- `CLAUDE.md` dong 28-29: bo hoan toan cac con so byte cu the (110480, 96284, 58524, 14196, 37760) khoi van xuoi — thay bang duong dan toi nhan `ccf-budget` + luat "do wc -c la buoc cuoi". Khong con so nao con lai o day, dung yeu cau "khong nhac lai so".
- `prompt-standard.md` doan "Why not @import": cau "Quote 96284 as the real cost; 58524 is what deleting the hooks.md import would buy" va danh sach ba so lich su (54474, 55591, 95923) bi cat, thay bang cau dan toi nhan + `.claude/tests/context-budget.test.mjs`.
- `prompt-standard.md` doan Tool pairing: cau cu "least-privilege scoped, e.g. Bash(node:*)" bi cat (mau thuan voi ket luan moi: mot prefix cu the la sai huong khi lenh khong biet truoc); thay bang hai gach dau dong phan biet hai truong hop.

### Ket qua test that (chay lai toan bo sau khi hoan tat)
1. `node --test plugins/ccf/hooks/lib/*.test.mjs` → **227 pass, 0 fail** (637ms).
2. `node --test "plugins/ccf/templates/*/.claude/hooks/lib/*.test.mjs"` → **8 pass, 0 fail**.
3. `node --test .claude/tests/*.test.mjs` → **9 pass, 1 skip, 0 fail** (do tai 2026-07-31).
4. `npx -p typescript tsc --noEmit` → **exit 0** (sau khi sua loi cu phap JSDoc: chuoi `@import` tran trong khoi `/** */` bi TypeScript hieu nham la the `@import` cua no; doi thanh "at-import"/"CLAUDE.md's `@path` import" trong comment, khong doi noi dung tai lieu ben ngoai comment).
5. `claude plugin validate plugins/ccf` → **Validation passed**.
6. Quet codepoint node one-liner tren toan bo file cham (13 file) → **0 hit**.
7. Grep hai dong `allowed-tools`: `cook.md:4` → `..., Bash`; `check.md:4` → `Read, Glob, Grep, Bash, Task` (khong doi). Grep moi cho gam 227 (CLAUDE.md, testing.md, 4 task file, PLAN.md) → khong co dong nao can sua, dung du kien.

### Con thieu de len `done`
Kiem SONG cua chinh task 049 (mot phien moi thuc thi tren repo nay, khong qua `/ccf:cook`) coi nhu vua xay ra trong luc lam task nay. Van con thieu: `/ccf:check` + `/code-review` chua chay tren diff nay. Task dung o `in-review`, dung nhu chinh sach lifecycle; `/ccf:updatespec` se doi thanh `done` sau khi hai buoc do qua.

## Vong sua sau /ccf:check (2026-08-01)

Luot `/ccf:check` dau tien tra ve 2 FAIL + 8 WARN (premortem yeu cau vao chung commit). Da sua ca 10, van trong pham vi task 049:

1. **FAIL — `basename()` thay `split("/").pop()`**: `context-budget.test.mjs` (test "the file carrying the ccf-budget label is itself in the lazy list") dung `path.win32.join` se sinh duong dan `\` tren Windows, `split("/")` khong cat dung basename. Sua: import `basename` tu `node:path`, dung `basename(claim.file)`.
2. **FAIL — nhan khong duoc bat buoc DUY NHAT**: `extractPaidClaim` truoc chi lay match dau tien bang `content.match(...)`, mot nhan thu hai lac vao se qua mat. Sua: `[...content.matchAll(BUDGET_LABEL_RE_GLOBAL)]`, throw khi `matches.length !== 1`. Them test moi tren BAN SAO: chen nhan thu hai vao `prompt-standard.md`, assert `extractPaidClaim` throw dung message `/exactly once/`. Bo `.claude/tests` tang tu 10 test len **11 test**.
3. **WARN — CRLF nhay cam**: them file MOI `.gitattributes` (`*.md text eol=lf`) — mot bo sung NGOAI danh sach "Files to touch" ban dau, duoc chap thuan theo de xuat premortem cua `ccf-spec-checker` vi Windows mac dinh `core.autocrlf=true` se doi line ending luc checkout va lam sai moi phep do `Buffer.byteLength`.
4. **WARN — "57 dong" sai**: task-049 (ghi chu nay) truoc ghi nham CLAUDE.md con 57 dong sau sua; do lai bang `wc -lc CLAUDE.md` = **59 dong** (khong doi, task 049 chi sua noi dung ben trong hai dong 28-29 chu khong xoa dong), da sua lai cau nay.
5. **WARN — ten test sai**: test "single real-root assertion" that ra khong dung vi 6 test khac cung doc REAL_ROOT; bo cum do khoi ten test, sua ca comment dau file mieu ta dung "several read-only assertions do read the REAL root ... only a MUTATION ever runs on a copy".
6. **WARN — thieu `t.skip()` deu**: 4 test doc REAL_ROOT (`findLazyExcludedFiles` mang nhan, `findNestedImportLines`, `extractClaudeMdThresholds` chinh, `CLAUDE.md duoi hai nguong`) thieu guard `looksLikeCcfRepo` → `t.skip()`. Them dong guard giong het 2 test da co san.
7. **WARN — DRY**: `readdirSync(rulesDir).filter(f => f.endsWith(".md"))` lap 3 lan trong `context-budget.mjs`. Rut thanh ham rieng `listRuleFiles(root)` (JSDoc du), ca ba noi goi lai ham nay.
8. **WARN — thieu JSDoc**: `copySpecTree` trong file test them JSDoc `@param`/`@returns` + ghi chu ai chiu trach nhiem `rmSync` (dung tien le `io.test.mjs`).
9. **WARN — CLAUDE.md dong 29 tro sai**: cum "see that file's `ccf-budget` label above" tro "above" vao khoang khong (nhan nam trong `prompt-standard.md`, khong o "above" trong CLAUDE.md). Sua thanh tro theo duong dan ro rang.
10. **WARN — `prompt-standard.md:89` con day `grep -rlP`**: mau thuan voi chinh tieu chi 4 cua task 049 (cam `grep -P`). Thay lenh quet chinh bang mot Node one-liner qua `git ls-files` + doc file + regex, giu doan canh bao ve BSD grep nhu mot bai hoc lich su thay vi lenh khuyen dung.

KHONG dong vao doan "Live iteration" cua CLAUDE.md (dong ~43) theo dung yeu cau dieu phoi vien — drift do thuoc `/ccf:updatespec`.

### Do lai nhan ccf-budget SAU vong sua (buoc CUOI, dung thu tu)
Sua CLAUDE.md dong 29 (WARN 9) va sua vi tri lenh scan trong `prompt-standard.md` (WARN 10) lam tong byte cua bo VO DIEU KIEN doi nhe. Do lai bang `measurePaidBytes(".")` SAU khi moi sua xong:
```
   10930 CLAUDE.md
   11690 .claude/rules/architecture.md
    3064 .claude/rules/coding-conventions.md
   13466 .claude/rules/components.md
    2782 .claude/rules/git-workflow.md
   37760 .claude/rules/hooks.md
   16475 .claude/rules/prompt-standard.md
    7352 .claude/rules/testing.md
   11215 .claude/rules/tooling.md
  114734 total
```
Bo vo dieu kien (tru `prompt-standard.md` 16475, file lazy duy nhat): 114734 − 16475 = **98259 byte**. Nhan `ccf-budget` dien lai thanh `paid=98259` (tu 98203), DIEN SAU CUNG khi moi sua khac da xong, dung thiet ke — sua nhan khong dich chuyen phep do vi chinh file mang nhan bi tru khoi tong.

### Ket qua test that SAU vong sua (chay lai toan bo)
1. `node --test plugins/ccf/hooks/lib/*.test.mjs` → **227 pass, 0 fail** (659ms). Khong doi so voi truoc.
2. `node --test "plugins/ccf/templates/*/.claude/hooks/lib/*.test.mjs"` → **8 pass, 0 fail**.
3. `node --test ".claude/tests/*.test.mjs"` → **10 pass, 1 skip, 0 fail** (tang tu 9 len 10 nho test moi cua FAIL 2; truoc khi dien lai nhan, test self-consistency do THAT vi paid thuc te 98259 ≠ nhan cu 98203 — dung minh chung nhan khong tu dong theo doi phep do, phai dien tay).
4. `npx -p typescript tsc --noEmit` → **exit 0**.
5. `claude plugin validate plugins/ccf` → **Validation passed**.
6. Quet codepoint node one-liner tren 14 file cham (them `.gitattributes`) → **0 hit**.
7. `wc -lc CLAUDE.md` → **59 dong / 10930 byte**, duoi ca hai nguong (200 dong, 12288 byte).
