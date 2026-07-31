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
