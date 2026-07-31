# Task 045: Chuan viet + xuong song /ccf:plan + doi ky hieu nguyen khoi

Model: opus
Agent: ccf-implementer (1 phien moi). MCP: context7 de doi chieu trich dan.
Depends on: (khong co, task dau iteration)
discipline: off

## Goal
1. Tao rule moi `.claude/rules/prompt-standard.md` voi frontmatter `paths: ["plugins/ccf/commands/**", "plugins/ccf/agents/**", "plugins/ccf/skills/**"]` (lazy-load). Noi dung: checklist 14 muc (xem "Checklist" duoi), van ban chuan khoi van phong v2 (xem "Khoi v2"), chinh sach codepoint (xem "Codepoint"), hai bang ky hieu (dau phat hien `FAIL:`/`WARN:`/`PASS:` va heading muc chu: `### Conforms` / `### Violations` / `### Should-reconsider` / `### Premortem`), va danh sach khac-nhau-co-chu-y giua 9 ban sao (heading rieng, dong Scope boundary rieng, cau target-project rieng cua ccf-spec-writer.md).
2. Sua `.claude/rules/coding-conventions.md`: muc Markdown chi sua VI DU ("STOP.", "Do NOT commit") sang vi du khang dinh kem ly do; giu luat menh lenh dut khoat. Sua luat thuat ngu (che do dich moi khai niem) theo quyet dinh nguoi dung: thuat ngu kho giu nguyen kem giai thich ngoac don lan dau.
3. Viet lai theo checklist: `plugins/ccf/commands/plan.md`, `plugins/ccf/agents/ccf-spec-checker.md`, `plugins/ccf/skills/grill-me/SKILL.md`. Dan khoi v2 vao plan.md va ccf-spec-checker.md.
4. Doi ky hieu NGUYEN KHOI tren be mat that da grep: ccf-spec-checker.md (4 vi tri), plan.md dong 72, cook.md dong 40 va 53, verify-chain.mjs dong 67/84/85 (chi chuoi hien thi), hooks.md dong 35 (2 emoji). check.md va init.md chua 0 ky hieu, khong cham. Ghi viec cham cook.md/hooks.md vao ghi chu task nay va task 046.
5. Ground qua Context7: tuong tac `@import` voi `paths:` (CLAUDE.md dang @import hooks.md co paths). Ghi ket luan + chon co che nap cho prompt-standard.md (import va tra gia ngan sach, hoac tai lieu maintainer tham chieu bang duong dan).
6. Cap nhat 4 README (`README.md`, `README.vi.md`, `README.zh-CN.md`, `plugins/ccf/README.md`) cho moi description doi.

## Checklist 14 muc (ghi vao rule, ap khi viet lai; nguon: Context7 /websites/code_claude + code.claude.com/docs/en/best-practices + platform.claude.com prompt-engineering/overview)
1. Ro va truc tiep (golden rule); buoc tuan tu danh so.
2. Moi "Do NOT X" tran phai kem hanh vi thay the.
3. Quy tac quan trong kem ly do.
4. Giam chu hoa nhan manh kieu CRITICAL/MUST (model moi phan ung qua da); giu thuc menh lenh.
5. The XML khi mot doan tron chi dan + vi du + input; khong ap moi heading.
6. Agent mo dau bang vai, ket bang chi dan dinh dang dau ra (khac tom tat lap).
7. description agent = trigger + pham vi + gioi han.
8. Few-shot 3 den 5 vi du trong the example, chi khi can (luat noi dung prompt, khong lien quan luat so muc dau ra).
9. Tai lieu dai dat truoc, cau lenh dat cuoi.
10. Khoi chong over-engineering trong ccf-implementer.
11. Cat tia tung dong, ngoai le cung: dong backup cho hook fail-open (plan.md buoc 0+6, init.md A4, cau "NOT done"), chuoi duoc parse, so hieu buoc duoc goi ten. Xuat danh sach dong da xoa.
12. Skill: tu khoa kich hoat len dau description; gioi han ky tu ground lai tai cho (1536 hay 1024, trich dan).
13. Chi dan suy nghi chung thay vi kich ban reasoning viet san.
14. Khong icon; ky hieu review theo hai bang chu.

## Khoi v2 (van ban chinh tac, tieng Anh, ghi vao rule; cac ban dan giu nguyen bullet, khac heading/scope co chu y)
Giu 7 bullet hien co (md5 khoang bullet hien tai: b9b42757dde53b7a03c38c25e76b6591, 795 byte) voi MOT sua doi va THEM cac bullet sau, roi chot md5 moi vao rule:
- SUA bullet dich thuat: "Translate a concept when the user's language has a natural equivalent; keep a difficult or ambiguous English term verbatim and add a short parenthetical explanation on first use."
- THEM: "Open with the point itself; never with generic filler. End when the content ends; never restate what was just said as a summary."
- THEM: "Cut adjectives that add no information; a claim earns its adjective with a concrete fact, number, or name."
- THEM: "Use as many bullets as there are real points, never a rounded count; prefer plain prose when ideas are not parallel."
- THEM: "Prefer a specific example, number, or name over an abstract description; give one clear recommendation instead of an option list with no conclusion; state uncertainty plainly."
- THEM: "Vary sentence length; do not repeat the same key phrase within a paragraph."
- THEM: "No icons or emoji in generated text; review markers use the word set FAIL:/WARN:/PASS:."

## Codepoint (ghi vao rule)
- Chan dung 5 codepoint, liet ke tuong minh, khong dung ten thuoc tinh Unicode: U+1F52E, U+274C, U+2705, U+26A0, U+FE0F (xoa theo cap).
- Cho phep: U+2190/2192/2194, U+2500 den U+257F, CJK, U+2026, U+2264/2265/2260, va U+2716/U+2717 nhu DU LIEU trong test-gate-core.mjs (nhanh logic FAIL_SIGNAL; them comment mien tru tai cho o task 048? KHONG: hai file test-gate-core khong duoc cham o bat ky task nao, comment mien tru ghi trong rule thay vi trong file).
- Loai tru khoi moi luot quet: .claude/plan/ARCHIVE.md va .claude/plan/archive/** (lich su verbatim).

## Bat bien phai giu (grep baseline truoc lan sua dau, so bang sau khi sua)
- `run_in_background: false` (do baseline truoc, hien 13 tren 6 lenh).
- Bo tu vung status chu tran todo/in-progress/in-review/done + cau "bare word, no markdown emphasis" trong plan.md buoc 7.
- Dinh dang dong `Model: <alias>` buoc 5 plan.md (cook.md parse).
- `AskUserQuestion` trong allowed-tools cua plan.md; token `discipline: on` trong plan.md buoc 5b va ccf-spec-checker.md.
- Cau gate chiu luc plan.md buoc 0 va buoc 6: viet lai duoc nhung giu nguyen nghia va do manh; chot ban nguyen van moi vao ghi chu task.
- name/model/effort/disallowedTools cua ccf-spec-checker; SKILL.md giu user-invocable: false, khong co disable-model-invocation true, allowed-tools co AskUserQuestion.
- So hieu buoc plan.md (0/1b/4/5/6) duoc goi tu architecture.md:16,19,22, tooling.md:50, hooks.md:30, plan.md noi bo: khong danh so lai, hoac sua dong thoi moi noi goi va assert file dich con dinh danh.
- KHONG sua bat ky assert nao trong test (verify-chain.test.mjs khong assert ky hieu cu, phai xanh nguyen trang).

## Test viet truoc (chay va ghi ket qua vao ghi chu task)
1. Baseline: grep dem run_in_background, ky hieu cu (U+274C/U+26A0/U+2705/U+1F52E) tung file, md5 khoi bullet 4 ban hien co.
2. Sau khi sua: grep ky hieu cu = 0 tren file da cham; ky hieu moi co o ca hai dau (ccf-spec-checker.md tra, plan.md + cook.md doc).
3. Predicate status: ghi PLAN.md tong hop vao thu muc tam theo dung huong dan cua plan.md moi, chay findActiveTask/findNonDoneTasks tu hooks/lib/plan.mjs, ket qua dung ky vong; dan cau prompt nguyen van canh bang tong hop vao ghi chu.
4. `node --test plugins/ccf/hooks/lib/*.test.mjs` = 227 pass; `node --test "plugins/ccf/templates/*/.claude/hooks/lib/*.test.mjs"` = 8 pass; `npx -p typescript tsc --noEmit` exit 0; `claude plugin validate plugins/ccf` passed.
5. Frontmatter assert (node one-liner): plan.md co description + allowed-tools; ccf-spec-checker.md co name/description/model/disallowedTools; SKILL.md co name/description/user-invocable, khong disable-model-invocation true.
6. Ngan sach: `wc -c CLAUDE.md .claude/rules/*.md` truoc/sau; bo vo dieu kien (tru file co paths:) khong phinh so 54474 byte; neu ket luan ground khac thi ghi so moi kem lenh.

## Acceptance
Moi muc Goal xong; moi test o tren xanh; danh sach thay doi luong kem trich dan + danh sach dong da cat + ban nguyen van cau gate ghi trong ghi chu task; 4 README dong bo. Kiem song (cai lai plugin, phien moi, mot luot /ccf:plan tron buoc 0/1b/grill-me/5/6/plan-review-gate) la dieu kien de len done; chua chay thi dung o in-review.

## Ghi chu thuc thi (task 045, phien ccf-implementer)

### Baseline do TRUOC lan sua dau tien
- `grep -c run_in_background plugins/ccf/commands/*.md` = 13 dong (check 1, fix 1, cook 3, init 4, plan 3, updatespec 1); `grep -o` = 18 lan, moi lan deu la `run_in_background: false`. SAU khi sua: van 13 dong / 18 lan.
- Codepoint bi chan, dem tung file (loai tru ARCHIVE.md + archive/**):
  - `plugins/ccf/agents/ccf-spec-checker.md` — U+1F52E 2, U+274C 2, U+2705 1, U+26A0 1, U+FE0F 1
  - `plugins/ccf/commands/plan.md` — U+274C 1, U+26A0 1, U+FE0F 1
  - `plugins/ccf/commands/cook.md` — U+274C 3
  - `plugins/ccf/hooks/lib/verify-chain.mjs` — U+274C 4
  - `.claude/rules/hooks.md` — U+274C 2
  - `check.md`, `init.md`, `grill-me/SKILL.md` — 0 (khong cham vi ky hieu)
  - SAU khi sua: quet toan repo chi con dung 7 file lich su (`ARCHIVE.md` + 6 file trong `archive/`), tat ca deu trong danh sach loai tru.
- md5 khoi bullet v1: `b9b42757dde53b7a03c38c25e76b6591`, 795 byte, GIONG NHAU o ca 4 ban (plan.md:15, init.md:14, updatespec.md:17, ccf-spec-writer.md:15).

### md5 khoi v2 (chot vao rule)
- 13 dong bullet, 1479 byte, md5 **`deac0ef73d3c0cb9d26766027a906385`**.
- Da xac nhan ban trong `plugins/ccf/commands/plan.md` (dong 15-27) khop dung md5 nay. Ban trong `ccf-spec-checker.md` dung cung 13 dong.
- Con 3 ban v1 chua doi (`init.md`, `updatespec.md`, `ccf-spec-writer.md`) — thuoc task 046/047. Đó là lý do task 048 phai doi chieu md5 cua moi ban.
- Ghi nhan mot mau thuan CO SAN, KHONG sua trong task nay: bullet 2 ("Keep identifiers verbatim … — translating an identifier makes it wrong") tu no chua mot em dash, trong khi bullet 4 cam em dash. Task 045 chi cho phep DUNG MOT sua doi tren 7 bullet cu (bullet dich thuat), nen sua them se lam 3 ban con lai o task 046/047 lech khoi ky vong. De xuat: xu ly o task 048 cung luc voi ca 9 ban, hoac chap nhan vi khoi la source tieng Anh cua repo chu khong phai van ban sinh ra cho user.

### Ket luan ground: `@import` va `paths:` (qua Context7 `/websites/code_claude`)
- Tai lieu mo ta HAI co che RIENG BIET va khong noi chung ket hop the nao: `@path/to/import` la chen van ban tu `CLAUDE.md` (`/en/memory`); `paths:` gate viec tu dong phat hien `.claude/rules/*` (`/en/memory`, `/en/claude-directory`, `/en/glossary` — "rules with `paths:` load only when Claude reads a matching file").
- QUAN SAT TRUC TIEP trong chinh phien nay da giai quyet cau hoi: `CLAUDE.md` dang `@import` `.claude/rules/hooks.md`, va `hooks.md` CO `paths: plugins/ccf/hooks/**`. Toan bo noi dung `hooks.md` van den trong context luc bat dau phien, TRUOC khi doc bat ky file nao duoi `plugins/ccf/hooks/**`. Ket luan: **`@import` nap vo dieu kien va vo hieu hoa `paths:` tren file do.**
- CHON CO CHE NAP cho `prompt-standard.md`: co `paths:` va **KHONG** `@import` tu `CLAUDE.md`. Duong dan tim thay duoc dat trong `.claude/rules/coding-conventions.md` (file nap moi phien), nen maintainer van tim ra file ma khong phai tra ngan sach.
- He qua khac: prompt cha cua phien nay noi `hooks.md` "may not auto-load" vi co `paths:` — dieu do SAI voi thuc te, no luon nap vi duoc `@import`.

### Ngan sach context
- Lenh: `wc -c CLAUDE.md .claude/rules/*.md`.
- Tong tat ca: 92142 → 104816 byte. Bo VO DIEU KIEN (tru file co `paths:`, nay la `hooks.md` 37760 + `prompt-standard.md` 11465): **54474 → 55591 byte (+1117)**.
- `prompt-standard.md` (11465 byte) gop **0 byte** vao bo vo dieu kien, dung nhu thiet ke.
- Toan bo +1117 byte den tu `coding-conventions.md` (2029 → 3146), la noi dung Goal 2 BAT BUOC phai them (vi du khang dinh kem ly do, luat thuat ngu, dong tro den rule moi) vao mot file khong co `paths:`. Khong phai do rule moi phinh ra.

### Thay doi luong (flow) kem trich dan
1. `plan.md` buoc 1b: doi tu cam ("Do NOT spawn the built-in `Explore` agent") sang the khang dinh co hanh vi thay the ("Route discovery through `ccf-codebase-analyzer` rather than the built-in `Explore` agent") — checklist muc 2. Lenh cam van con hieu luc trong cung cau. Tieu de bo hau to "(NOT the built-in Explore)"; so hieu buoc 1b GIU NGUYEN vi `architecture.md:16` va `init.md:71` goi ten no.
2. `plan.md` buoc 7: THEM mot bullet moi bat status phai la tu tran khong markdown emphasis. Bullet nay truoc day KHONG ton tai trong prompt, du `lib/plan.mjs#stripEmphasis` da phai sinh ra chinh vi PLAN.md cua repo nay tung viet `**done**`. Nay ca hai dau da khop (hook phong ve + prompt yeu cau).
3. `plan.md` buoc 6 + `cook.md` buoc 3/5: dieu kien loop/stop doi tu ky hieu sang tu — doc `### Violations` / `### Should-reconsider` va `FAIL:`. Ca hai dau di cung nhau voi ben SAN XUAT la `ccf-spec-checker.md`.
4. `ccf-spec-checker.md`: THEM muc "Style for user-facing text" (khoi v2) va muc "Marker vocabulary"; Return format doi 4 heading emoji sang 4 heading chu. heading `Spec drift` (U+26A0 U+FE0F) gop vao `### Should-reconsider` va nghia "spec drift" duoc giu trong noi dung dong entry.
5. `SKILL.md`: bullet ky luat phong van thanh 5 buoc DANH SO kem ly do (checklist muc 1 + 3), va THEM mot khoi `<example>` 3 vi du cho mau "confirm thay vi hoi mu" (checklist muc 5 + 8) — day la hanh vi bi lam sai nhieu nhat trong ky luat nay.
6. `coding-conventions.md`: vi du menh lenh doi sang the khang dinh kem ly do; THEM luat thuat ngu (giu tu kho nguyen dang kem giai thich ngoac don lan dau); THEM dong tro den `prompt-standard.md`.
- Trich dan checklist: Context7 `/websites/code_claude` (`/en/memory`, `/en/claude-directory`, `/en/glossary`, `/en/slash-commands`, `/en/settings`, `/en/large-codebases`, `/en/prompt-caching`). Trong phien nay hai muc duoc ground LAI truc tiep: muc 12 (gioi han 1536 ky tu) va tuong tac `@import`/`paths:`. Cac muc con lai giu trich dan tu ban ke hoach.
- Gioi han ky tu description skill: **1,536** (khong phai 1024) cho `description` + `when_to_use` cong lai, mac dinh cua setting `skillListingMaxDescChars` — `code.claude.com/docs/en/slash-commands` + `/en/settings`. Description moi cua `grill-me` dai 379 ky tu.

### Danh sach dong da xoa (khong co dong nao bi bo hoan toan)
So dong co noi dung: plan.md 64 → 71, ccf-spec-checker.md 38 → 55, SKILL.md 53 → 61. So bullet: plan.md 35 → 41 (+6 = 6 bullet moi cua khoi v2), ccf-spec-checker.md 17 → 30 (+13 = khoi v2), SKILL.md 36 → 36. Khong co noi dung nao bi mat; moi dong bien mat trong diff deu co ban viet lai tuong duong. Nhung doan bi CAT HAN (khong co ban thay the):
- `plan.md` tieu de 1b: hau to `(NOT the built-in Explore)`.
- `plan.md` buoc 5: cap ngoac `(In plan mode, the writing is presented as the plan for approval.)` → thanh cau thuong, bo ngoac.
- `plan.md` buoc 1b: cum `This is read-only research, so parallelism is allowed here` → gon lai `Read-only research may fan out`.
- `ccf-spec-checker.md` Return format: 4 heading emoji (`Conforms` U+2705, `Violations` U+274C, `Spec drift` U+26A0 U+FE0F, `Premortem (prospective failures)` U+1F52E) → 4 heading chu; rieng `Spec drift` khong con la heading doc lap.
- `SKILL.md` description: cum `— do not trigger it from ordinary conversation` → `, and never triggered from ordinary conversation` (bat buoc: xem loi YAML duoi).

### Ban NGUYEN VAN cau gate moi
`plan.md` buoc 0 (dong dau):
> **STOP.** Confirm this session is in plan mode before anything else. If it is not, refuse to continue: tell the user to enter plan mode (Shift+Tab cycles to 'plan', or start the session with `--permission-mode plan`), then re-run `/ccf:plan`. Do not run any step below. The `plan-mode-guard` hook blocks this deterministically too; this sentence is the backup for the case where the hook does not fire.

`plan.md` buoc 6 (cau mo dau cua gate):
> **STOP.** Do not call ExitPlanMode, and do not present the plan for approval, until a fresh-context `ccf-spec-checker` subagent has reviewed the PLAN ITSELF (the plan, not the code).

`plan.md` buoc 6 (dong backup cho hook fail-open, giu nguyen chuc nang):
> This is enforced deterministically: the `plan-review-gate` PreToolUse hook DENIES `ExitPlanMode` in a `/ccf:plan` session until it sees a `ccf-spec-checker` review in the transcript. This step is the defense-in-depth backup for the case where the hook fails open; do not rely on the hook alone.

### Ket qua test (chay that)
1. `node --test plugins/ccf/hooks/lib/*.test.mjs` → **227 pass, 0 fail** (duration 619ms). Khong sua bat ky assert nao.
2. `node --test "plugins/ccf/templates/*/.claude/hooks/lib/*.test.mjs"` → **8 pass, 0 fail**. Hai file `test-gate-core*` KHONG bi cham (U+2716/U+2717 trong `FAIL_SIGNAL` con nguyen; mien tru duoc ghi trong `prompt-standard.md` thay vi trong file).
3. `npx -p typescript tsc --noEmit` → **exit 0**.
4. `claude plugin validate plugins/ccf` → **Validation passed**.
5. Frontmatter assert (node one-liner) → 15/15 PASS: `plan.md` co `description`/`allowed-tools`/`AskUserQuestion`/`model`; `ccf-spec-checker.md` co `name`/`description`/`model: opus`/`effort: high`/`disallowedTools: Write, Edit, NotebookEdit, Agent, Task`; `SKILL.md` co `name`/`description`/`user-invocable: false`/`AskUserQuestion`, KHONG co `disable-model-invocation: true`.
6. Predicate status: viet PLAN.md tong hop vao thu muc tam theo dung huong dan MOI cua `plan.md` buoc 7 (tu tran, khong emphasis), roi chay `plan.mjs`. Bang tong hop:
   ```
   | # | Task | Predecessor | Status |
   | --- | --- | --- | --- |
   | 045 | Prompt standard + plan backbone | - | in-review |
   | 046 | Implement + verify surfaces | 045 | todo |
   | 047 | Init/fix/agents surfaces | 046 | todo |
   | 044 | Earlier closed task | - | done |
   ```
   Cau prompt NGUYEN VAN da huong dan cach viet bang tren (`plan.md` buoc 7, bullet moi):
   > Write each status as a **bare word, with no markdown emphasis** (`in-review`, not `**in-review**`). The Stop hook's `lib/plan.mjs` compares the status cell against anchored predicates, and although it strips emphasis defensively, decorating the cell has already made two finished tasks read as open in this project's own history.

   Ket qua: `findActiveTask` → `{"id":"045","title":"Prompt standard + plan backbone"}` (dung, row `in-review`); `findNonDoneTasks` → 3 row `045,046,047` (dung, row `done` bi loai). Ca hai PASS.

### LOI THAT do gate bat duoc (dang ghi lai)
`claude plugin validate` FAIL lan dau: `YAML frontmatter failed to parse: YAML Parse error: Unexpected token`. Nguyen nhan: description moi cua `SKILL.md` chua chuoi `command: do` — trong YAML mot plain scalar KHONG duoc chua `": "`. Neu chi chay test + tsc thi loi nay di qua, va skill se load voi metadata RONG (moi field frontmatter bi bo im lang). Da sua bang cach viet lai thanh `, and never triggered from ordinary conversation.`. Bai hoc: bat ky description viet lai o task 046/047 phai tranh `": "` va phai chay `claude plugin validate` chu khong chi test.

### File bi cham ngoai 3 prompt (ghi de task 046 doi chieu)
- `plugins/ccf/commands/cook.md` — CHI doi dieu kien ky hieu o buoc 3 va buoc 5 (2 dong, 3 lan U+274C). Phan con lai cua `cook.md` (viet lai theo checklist + khoi v2) THUOC TASK 046, chua lam.
- `.claude/rules/hooks.md` — CHI doi 1 dong (2 lan U+274C trong doan mo ta `buildVerifyReason`), them tro den `prompt-standard.md`. No no van la mon no ~38KB, khong giai quyet o day.
- `plugins/ccf/hooks/lib/verify-chain.mjs` — CHI doi chuoi hien thi + JSDoc (dong 67, 84, 85). Khong doi logic, khong doi assert. `verify-chain.test.mjs` khong assert ky hieu nao nen van xanh nguyen trang.
- 4 README: **khong can sua**. Ca 4 chi DIEN GIAI description chu khong trich nguyen van (`README.md:69`, `README.vi.md:69`, `README.zh-CN.md:69`, `plugins/ccf/README.md:19` cho `ccf-spec-checker`; `:127` va `plugins/ccf/README.md:22` cho `grill-me`), va ca hai ban dien giai van dung sau khi doi description. README cung khong trich Return format nen 4 heading moi khong lo ra do. Da kiem: `grep -rn "Conforms\|Violations\|Should-reconsider\|Spec drift"` tren 4 README → 0 ket qua; quet codepoint tren 4 README → 0.

### Con thieu de len `done`
Kiem SONG chua chay: cai lai plugin, phien moi, mot luot `/ccf:plan` di tron buoc 0 → 1b → grill-me → 5 → 5b → 6 → `plan-review-gate`. Plugin chay tu ban CACHE da cai chu khong tu repo nay, nen moi thay doi prompt o tren la UN-OBSERVED cho toi khi reload. Vi vay task dung o `in-review`.
