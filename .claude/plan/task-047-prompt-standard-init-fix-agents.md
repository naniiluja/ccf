# Task 047: Luong init + fix + 4 agent con lai

Model: opus
Agent: ccf-implementer (1 phien moi). MCP: context7.
Depends on: 046
discipline: off

## Goal
Viet lai theo checklist 14 muc cua `.claude/rules/prompt-standard.md`: `plugins/ccf/commands/init.md`, `plugins/ccf/commands/fix.md`, `plugins/ccf/agents/ccf-codebase-analyzer.md`, `plugins/ccf/agents/ccf-best-practice-researcher.md`, `plugins/ccf/agents/ccf-debugger.md`, `plugins/ccf/agents/ccf-spec-writer.md`. Dan khoi v2 (tu rule) vao init.md, fix.md, ccf-debugger.md, ccf-spec-writer.md (ban cua spec-writer giu them cau target-project rieng, xem danh sach khac-nhau-co-chu-y trong rule). Thay doi luong phai co trich dan; khong thi giu nguyen. Cap nhat 4 README.

## Bat bien phai giu
- Cau gate A4 cua init.md: lop cuong che DUY NHAT (khong hook sau lung); viet lai duoc nhung giu nguyen nghia chan-cho-toi-khi-review-xong; chot ban nguyen van moi vao ghi chu; ky hieu doc ket qua review dung bang chu tu rule (init.md hien khong chua ky hieu icon nao, giu nguyen tinh trang do).
- `AskUserQuestion` trong allowed-tools cua init.md va fix.md; cau hoi model trong ca hai giu nguyen hanh vi hoi that (khong ha thanh "neu mac dinh").
- name/model/effort/disallowedTools cua 4 agent (read-only giu du disallowedTools: Write, Edit, NotebookEdit, Agent, Task); description = trigger + pham vi + gioi han.
- So hieu buoc/muc init.md (A4, B1, B3, step 1b noi bo) duoc goi tu architecture.md:16 va chinh init.md; khong danh so lai hoac sua dong thoi + assert.
- `run_in_background: false` baseline truoc/sau; khong sua assert test nao; khong cham 2 file test-gate-core.
- Bao cao analyzer set A/set B va muc Unknowns cua ccf-codebase-analyzer.md giu nguyen cau truc (044 vua dua vao, plan.md 1b phu thuoc).

## Test viet truoc
1. Grep ky hieu icon = 0 tren 6 file (init/fix von 0, giu 0; 4 agent: chi ccf-codebase-analyzer co 1 mui ten, mui ten thuoc danh sach cho phep).
2. md5 khoi bullet 4 ban dan khop rule (rieng spec-writer co cau them ngoai khoang bullet).
3. 227 test + 8 test template + tsc + validate; frontmatter assert 6 file; ngan sach wc truoc/sau; grep AskUserQuestion 2 lenh.

## Acceptance
Goal xong, test xanh, ghi chu du. Kiem song bat buoc, hep: (a) chay `/ccf:fix` toi khi cau hoi model hien that qua AskUserQuestion roi dung; (b) chay `/ccf:init` trong mot scratch dir toi A4 va xac nhan no dung cho review. Chua chay hai quan sat nay thi task dung o in-review.

## Ghi chu thuc thi (task 047, phien ccf-implementer)

### Baseline do TRUOC lan sua dau, va so lai SAU
| Do luong | Truoc | Sau |
| --- | --- | --- |
| Literal `run_in_background: false` init.md | 4 (4 dong) | 4 (4 dong) |
| Literal `run_in_background: false` fix.md | 1 (1 dong) | 1 (1 dong) |
| Token `run_in_background` (moi dang) init.md | 5 lan / 4 dong | 4 lan / 4 dong |
| Token `run_in_background` (moi dang) fix.md | 2 lan / 1 dong | 2 lan / 1 dong |
| Tong `run_in_background` tren 6 lenh | 18 lan | 17 lan |
| Codepoint bi chan tren 6 file dich | 0 moi file | 0 moi file |
| Quet codepoint toan repo (tru ARCHIVE.md + archive/**) | 0 file | 0 file |
| U+2192 trong ccf-codebase-analyzer.md | 1 | 1 (cho phep) |
| `AskUserQuestion` init.md / fix.md | 2 / 2 lan | 3 / 3 lan |
| `wc -lc` init.md | 107 / 15469 | 111 / 15918 |
| `wc -lc` fix.md | 35 / 4441 | 54 / 6888 |
| `wc -lc` ccf-codebase-analyzer.md | 84 / 6303 | 77 / 6958 |
| `wc -lc` ccf-best-practice-researcher.md | 34 / 1991 | 35 / 2740 |
| `wc -lc` ccf-debugger.md | 38 / 2078 | 54 / 4498 |
| `wc -lc` ccf-spec-writer.md | 36 / 3275 | 42 / 4281 |
| `wc -c CLAUDE.md .claude/rules/*.md` (tong) | 104734 | 104734 |

Hai con so can giai thich:
- **Tong `run_in_background` 18 → 17.** Invariant that su (`run_init_background: false` co mat tai MOI call site) khong doi: init.md van 4 dong / 4 literal cho 4 call site (A2, A4, B1, B2), fix.md van 1 dong / 1 literal. Cho bi bot la lan nhac THU HAI cung token trong CUNG mot cau o B1 (ban cu: "pass `run_in_background: false` on all 5 spawns … since Claude Code v2.1.198 an omitted `run_in_background` defaults to background"); ban moi viet lan hai la "an omitted flag", theo bullet "do not repeat the same key phrase within a paragraph". Khong call site nao mat co.
- **Ngan sach context khong doi (104734).** Task 047 khong sua file rule nao (`git diff --stat -- CLAUDE.md .claude/rules/` chi con 2 file cua task 045). Bo VO DIEU KIEN van la **55509 byte** dung nhu so do-lai cua 046.
- `AskUserQuestion` 2 → 3 lan tren ca hai lenh: van 1 lan trong `allowed-tools`, phan than tang tu 1 len 2 vi cau hoi model duoc tach thanh bullet rieng (cau hoi + duong lui khi tool bi chan). Hanh vi hoi that duoc giu, khong ha xuong "state a default".

### md5 khoi v2: 9 ban khop, do bang `sed | md5`
Lenh do tung file (start = dong `- Write in the SAME language`, end = start+12): `sed -n "${s},${e}p" <file> | md5`.
Ket qua: **9 ban prompt + 1 ban trong rule, tat ca 1479 byte, md5 `deac0ef73d3c0cb9d26766027a906385`**.
`prompt-standard.md:44`, `plan.md:15`, `check.md:12`, `updatespec.md:17`, `cook.md:14`, `init.md:14`, `fix.md:12`, `ccf-spec-checker.md:15`, `ccf-spec-writer.md:15`, `ccf-debugger.md:19`.
- 4 ban dan trong task nay (init.md, fix.md, ccf-debugger.md, ccf-spec-writer.md) KHONG go tay: script node (`scratchpad/paste-block.mjs`) cat dung dong 44-56 cua rule roi thay cho o giu cho `@@STYLE_BLOCK@@`, va tu assert rang dong dau/dong cuoi cua khoi vua cat dung nhu ky vong.
- `ccf-spec-writer.md` giu cau target-project rieng NGOAI khoang bullet: no nam trong dong `**Scope boundary:**` (dong 14), tren bullet dau. Chinh vi vay md5 khoang bullet cua no van khop tuyet doi.
- `grep -rln "^- Write in the SAME language" plugins/ccf` = **9 file**, dung ket-thuc-iteration ma rule mo ta. Hai agent KHONG mang khoi nay la `ccf-codebase-analyzer` va `ccf-best-practice-researcher`: dau ra cua ho la bao cao co cau truc cho LENH goi doc va gap vao spec/plan, chu khong phai van ban di truc tiep den nguoi doc; task 047 chi liet ke 4 file phai dan va rule chot con so 9.

### Ban NGUYEN VAN cau gate A4 moi (`init.md` dong 67)
> **STOP.** Do not proceed to A5 until a fresh-context `ccf-spec-checker` subagent has critiqued the plan you just generated. Delegate it via Task in plan-review mode, read-only, **with `run_in_background: false`**: a Task spawn omitting that flag defaults to background since Claude Code v2.1.198, which would let A5 close the command before the review exists. `/ccf:init` does not run in plan mode, so there is no `ExitPlanMode` call for the `plan-review-gate` hook to deny, and this paragraph is the ONLY layer enforcing the gate here. Have the reviewer check that slices are truly vertical, that gates are real and verifiable, that each task has exactly one predecessor, that no task hides multiple concerns, and that nothing drifts from the spec, PLUS its **premortem / prospective-failure lens** (the top 2 to 4 failure modes, each with a preventing change; a brand-new project has no past failures to anchor to, so it reports `anchor: none`). **Loop**: while the review returns anything under `### Violations` or `### Should-reconsider`, fix the plan and re-review, until both sections are empty or the user knowingly accepts a finding. **Resolve every H-likelihood premortem finding** by fixing the plan or by having the user knowingly accept it, and record each H-finding's **disposition** (`fixed-by …` / `accepted-because …`) in the plan so an accepted high risk stays auditable.

Ban cu de doi chieu do manh: "**MANDATORY review gate:** after generating the plan, **STOP — do NOT proceed to A5 until** a fresh-context `ccf-spec-checker` subagent (plan-review mode, read-only, via Task **with `run_in_background: false`** …) has critiqued it: … Fold the critique back in (loop until clean, or the user knowingly accepts a finding) before closing. **Every H-likelihood premortem finding MUST be resolved** … (`/ccf:init` does not run in plan mode, so there is no ExitPlanMode hook here — this prompt gate is the enforcement.)"
Cung du 5 menh de: STOP truoc A5, review boi `ccf-spec-checker` fresh-context + read-only + `run_in_background: false`, tieu chi critique + premortem, loop den khi sach hoac nguoi dung chap nhan, va H-finding phai co disposition. Cau "chi co lop nay cuong che" duoc noi MANH HON ban cu (ban cu: "this prompt gate is the enforcement"; ban moi: "this paragraph is the ONLY layer enforcing the gate here", kem ly do khong co `ExitPlanMode` cho hook chan). Khong ky hieu icon nao duoc them (init.md van 0).

### Thay doi luong (flow) kem trich dan
1. **`fix.md` THEM buoc `## 0a. Style for user-facing text`** va **`ccf-debugger.md` THEM muc `## Style for user-facing text`** (khoi v2 + dong `Scope boundary:` rieng). Hanh vi MOI: bao cao tung buoc cua `/ccf:fix` va trace/judgment cua debugger gio phai viet bang ngon ngu nguoi dung. Trich dan: `.claude/rules/prompt-standard.md` muc "Canonical style block for user-facing text" ("Every command or agent that emits text a human reads carries this block") + muc "What may differ between copies" (heading co so cho lenh, heading tran cho agent, dong Scope boundary rieng tung file).
2. **`init.md` + `ccf-spec-writer.md` nang khoi v1 → v2** (7 bullet → 13). Nghia doi thuc su o mot bullet: che do dich khong con la "translate every other concept" ma la "keep a difficult or ambiguous English term verbatim and add a short parenthetical explanation on first use". Trich dan: cung muc rule tren; quyet dinh nay do nguoi dung chot o task 045.
3. **`init.md` GOP khoi fold `testing.md.tmpl` cua A3 va B3 thanh mot muc `## Reference: folding the testing answers into testing.md.tmpl`** dat TRUOC hai branch; A3/B3 chi con mot dong tro den no, giu lai dung mot khac biet that ("A3 lay tu cau tra loi phong van, B3 lay tu test setup analyzer quan sat va phong van xac nhan"). Truoc day hai khoi 9 dong gan nhu trung nhau tung chu, ke ca doan `test-gate-core.mjs` verbatim. Trich dan: `prompt-standard.md` checklist muc 11 ("Every line must add information the model does not already have") + muc 9 ("Long reference material first, the instruction last") + `.claude/rules/coding-conventions.md` muc DRY. So hieu buoc A3/B3 GIU NGUYEN vi `architecture.md:16` goi B1 va chinh init.md goi A3/A4/A5/B3; noi dung bat buoc cua `hooks.md:69` ("must instantiate ALL three", strip `.tmpl`, copy lib verbatim) van nam nguyen van trong muc Reference.
4. **`init.md` A4 doi dieu kien loop sang bo heading chu** (`### Violations` / `### Should-reconsider`) thay cho "loop until clean" mo ho. Trich dan: `prompt-standard.md` muc "Review marker vocabulary" ("Both ends of this vocabulary must move together") + `ccf-spec-checker.md` Return format (ben SAN XUAT, doi o task 045); `plan.md` buoc 6 va `check.md` buoc 6 da doc dung bo heading nay tu 045/046, A4 la mat xich con thieu.
5. **`fix.md` buoc 2 doi blockquote thanh van ban thuong + 3 bullet**, tach cau hoi model ra khoi doan van dai. Khong doi hanh vi: van ASK qua `AskUserQuestion` MOT lan truoc khi spawn, van recommend `opus` co nhan, van co duong lui "noi ro da dung default vi bi chan". Trich dan: `prompt-standard.md` checklist muc 1 (ro va truc tiep, buoc danh so) + muc 4 (giam chu hoa nhan manh).
6. **3 description agent them GIOI HAN theo checklist muc 7**: `ccf-codebase-analyzer` ("returns a structured report of what exists. Proposes no solutions and writes no files."), `ccf-best-practice-researcher` ("Read-only, and it drafts no spec and writes no files."), `ccf-spec-writer` ("Used by /ccf:init and /ccf:updatespec." + `<200` viet thanh `under 200` cho an toan YAML). Trich dan GROUND LAI trong phien nay qua Context7 `/websites/code_claude`: `/en/sub-agents` ("Claude automatically delegates tasks based on … the `description` field in subagent configurations") va `/en/agent-sdk/subagents` ("Claude automatically decides when to invoke subagents by matching the task in your prompt with each subagent's description … it is important to write clear and specific descriptions"). `ccf-debugger` description GIU NGUYEN vi da du trigger + pham vi + gioi han ("Does NOT fix code").
7. **KHONG doi luong nao khac.** Giu nguyen: 9 so hieu buoc init.md (A1-A5, B1-B4), thu tu 6 buoc fix.md + muc `## Closing (mandatory)`, cau truc set A / set B va muc `### Unknowns / what I could NOT determine` cua analyzer (them mot cau noi ro `plan.md` buoc 2 bien tung unknown thanh cau hoi phong van, khong bo heading), 4 khoi Return format (analyzer set A + set B, debugger, researcher, spec-writer) giu nguyen tung dong trong fence.

### Danh sach dong da cat (khong con ban thay the)
- `init.md` A3 va B3: toan bo khoi `- **Fold the testing answer into testing.md.tmpl (deterministic, grill-me only asks — /ccf:init writes):**` cung 8 dong con o MOI branch → gop thanh muc Reference + mot dong tro den (thay doi luong 3). Khong noi dung nao mat: doi chieu tung placeholder (`{{TEST_FRAMEWORK}}`, `{{TEST_CMD}}`, `{{TEST_LOCATION}}`, `{{COVERAGE_TARGET}}`, `{{TEST_MATRIX_REQUIRED}}`, `{{INTEGRATION_TEST_SCOPE}}`, `{{E2E_TEST_SCOPE}}`, `{{TEST_GATE_ENFORCEMENT}}`) va ca 3 duong dan instantiate deu con.
- `init.md` A4: nhan `**MANDATORY review gate:**` → do manh chuyen vao `**STOP.**` + cau "ONLY layer enforcing the gate here".
- `init.md` A5/B4: `Do NOT run git.` → `Run no git command here; leave that to the user.`; `Do NOT commit.` → `Leave committing to the user.` (checklist muc 2: cam kem hanh vi thay the).
- `init.md` B1: cum `Do NOT silently spawn the session's own model just because it is what you are running as` → tach thanh bullet khang dinh `Do not spawn the session's own model just because it is what you are running as. The analyzer's model frontmatter is a DEFAULT …`; cum `Each returns a structured report; they must NOT write files.` → `Each returns a structured report and writes no files (their disallowedTools enforces that).`
- `init.md` Guardrails: `Specs must be verifiable.` → `Every rule you write must be verifiable, so that a later /ccf:check can actually test it.`; `Do NOT run git unless the user asks.` → `Run a git command only when the user asks for one.`
- `fix.md` mo dau: cum `Never guess and fix on the spot.` → cau co ly do `A fix written before the evidence is a guess, and a guess that happens to work hides the real defect.`; cum `ONLY THEN fix` giu nghia thanh `and only then fix`.
- `fix.md` buoc 2: `Go sequentially, no jumping ahead.` → `Work through the boundaries in order rather than jumping to the suspected one, because the skipped boundary is where the surprise usually is.`; blockquote `>` bi bo (thay doi luong 5).
- `fix.md` buoc 5: `Fix only within the bug's scope; do NOT refactor on the side.` → `Stay inside the bug's scope, and leave any refactor you notice to a separate task.`
- `fix.md` buoc 6: `Do NOT auto-apply it` → `Do not apply it in this run` kem ly do sequential law; `## Closing` muc 3 `Do NOT commit/push unless the user explicitly asks.` → `Commit or push only when the user explicitly asks.`
- `ccf-codebase-analyzer.md`: `**Don't propose solutions.**` → `**Describe what EXISTS; leave solutions to another agent.**` (kem ten agent lam viec do); `Never run state-changing commands.` → `Run no state-changing command, since five analyzers touching one working tree in parallel would race each other.`; `no speculation` → cau noi ro hau qua ("An uncited claim reads as speculation and the planner has to verify it anyway"). Dong `You do NOT write/edit any file.` bo khoi doan mo dau vi doan ngay sau da noi day du (READ-ONLY + leaf), thay bang cau giai thich 4 analyzer khac chay song song.
- `ccf-best-practice-researcher.md`: `Keep it concise — this is input for spec generation, not a long article.` → chuyen len TRUOC fence Return format (checklist muc 9: chi dan dat canh tai lieu no ap dung) va viet ro "One block per topic, and nothing else".
- `ccf-debugger.md`: `**Go sequentially, no jumping.** Follow the flow one boundary at a time.` → `**Follow the boundaries in order.**` kem ly do; `You do NOT fix code — you only return evidence and judgment.` → noi ro AI fix (`/ccf:fix` buoc 5) thay vi chi cam.
- `ccf-spec-writer.md`: `## Spec-writing rules (mandatory)` → `## Spec-writing rules` (checklist muc 4, bo nhan manh du); `**Drop anything Claude can infer.** Don't cram in default language conventions, don't describe every file.` → giu ca hai vi du kem ly do dilution; `So the main thread can copy verbatim and write.` → gop vao cau cuoi cua Return format.
- Khong dong nao mang thong tin bi bo hoan toan.

### Ket qua test (chay that)
1. `node --test plugins/ccf/hooks/lib/*.test.mjs` → **227 pass, 0 fail** (539ms). Khong sua bat ky assert nao.
2. `node --test "plugins/ccf/templates/*/.claude/hooks/lib/*.test.mjs"` → **8 pass, 0 fail**. `git diff --stat -- plugins/ccf/templates/root/.claude/hooks/lib/` → RONG (2 file `test-gate-core*` khong bi cham, U+2716/U+2717 trong `FAIL_SIGNAL` con nguyen).
3. `npx -p typescript tsc --noEmit` → **exit 0**.
4. `claude plugin validate plugins/ccf` → **Validation passed** (exit 0). Chay SAU khi viet lai ca 6 file, vi day la gate duy nhat bat duoc bay YAML `": "` ma task 045 tung dinh. Ghi nhan: `init.md` co `argument-hint: "[optional: short description …]"` chua `": "` nhung nam trong scalar CO NGOAC KEP nen hop le; assert phai phan biet quoted va plain, ban dau viet sai va bao FAIL gia mot lan.
5. Frontmatter + vi tri assert (34 case, `scratchpad/fm-assert.mjs`) → **34 pass, 0 fail**: 2 lenh du `description`/`argument-hint`/`model` va co `AskUserQuestion` trong `allowed-tools`; 4 agent du `name` (khop ten file) / `description` / `model` / `effort` va `disallowedTools` DUNG chuoi `Write, Edit, NotebookEdit, Agent, Task`; khong plain-scalar nao chua `": "`.
6. md5 khoi v2 tren ca 9 ban + ban trong rule → khop `deac0ef73d3c0cb9d26766027a906385` (xem muc md5 o tren).
7. Quet codepoint bi chan: 0 tren 6 file dich, va quet toan repo (tru `ARCHIVE.md` + `archive/**`) → khong file nao.
8. Predicate status tren `PLAN.md` that sau khi doi row 047: `findActiveTask` → `{"id":"045",…}` (row 045 la row in-review dau tien), `findNonDoneTasks` → `045:in-review, 046:in-review, 047:in-review, 048:todo`, `findRetirableIterationsIn` → `[]`. Row 047 duoc viet la tu tran `in-review`, khong markdown emphasis.

### 4 README
- `README.md`, `README.vi.md`, `README.zh-CN.md`: sua 2 dong moi file cho 2 description doi nghia — row `ccf-codebase-analyzer` them "bao cao hien trang, khong de xuat giai phap", row `ccf-spec-writer` them "dung cho `/ccf:init` va `/ccf:updatespec`; luong chinh moi la noi ghi file".
- `ccf-best-practice-researcher`: description them gioi han read-only/khong ghi file, nhung ca 3 README DA mang cot Mode = `read-only`/`只读`, nen khong co gi de dong bo; khong sua.
- `plugins/ccf/README.md`: chi chua comment trong cay file (`# x5 in parallel: onboard (init) or scope a change (plan)`, `# draft the spec`), khong trich description, va van dung sau khi sua; khong cham de khong lam lech cot ASCII.
- Quet codepoint bi chan tren 4 README → 0.

### Ra drift phat hien nhung KHONG sua o task nay (de task 048 / `/ccf:check` xu ly)
- `README.md:125` viet "**Commands** = 7 markdown prompts … init, plan, check, test, fix, updatespec, cook" trong khi chi co **6** lenh va khong co lenh `test`. Drift co san, thuoc pham vi dem-artifact cua task 048.
- `README.md:81` van viet `updatespec-nudge` co "Three independent nudges" trong khi hook da co BON clause (A-D). Da duoc task 046 bao cao, van chua sua.

### Con thieu de len `done`
Kiem SONG chua chay (plugin thi hanh tu ban CACHE da cai, khong tu repo nay, nen ca 6 file viet lai o day la UN-OBSERVED cho toi khi cai lai plugin + mo phien moi):
- (a) `/ccf:fix` chay toi khi cau hoi model hien that qua `AskUserQuestion` roi dung.
- (b) `/ccf:init` chay trong mot scratch dir toi A4 va xac nhan no thuc su dung cho `ccf-spec-checker` review.
