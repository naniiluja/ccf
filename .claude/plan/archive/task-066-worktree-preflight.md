# Task 066 — Script preflight worktree chỉ đọc (bước 3 của đề xuất 064)

- **Loại:** code (lib thuần + script do người chạy) cộng doc và đồng bộ số script.
- **Spec refs:** `task-064-worktree-parallel-research.md` mục 3, 4 bước 1 (preflight), 5 (không lẫn), 9 bước 3; `.claude/rules/architecture.md` (script, không phải hook); `.claude/rules/hooks.md` (không dependency, Windows-clean, `spawnSync` với `shell:false`).
- **Phạm vi:** chỉ ĐỌC. Không merge, không xóa worktree, không ghi ledger; những việc đó là bước 4 (`integrate-wave --apply`), chưa làm.

## Thiết kế
- Tìm branch: `--branches a,b` nếu có, ngược lại mọi `refs/heads/worktree-ccf-*` (tên mà `claude -w ccf-<iteration>-<taskid>` tạo ra). Task id là đoạn cuối sau dấu `-`.
- Mỗi branch: tìm `task-<id>-*.md` trong `.claude/plan/` của checkout chính, đọc `Files to touch` bằng `extractFiles` (065); tập file thật là `git diff --name-only <merge-base> <branch>`.
- Lỗi chặn (`ready: false`): không có branch; branch không khớp task file; hai branch cùng một task; task không khai báo file; file thật nằm ngoài khai báo và không phải test (so bằng `pathsClash` của 065, nên glob và thư mục trong khai báo vẫn đúng); hai branch trong wave cùng sửa một file thật; `git merge-tree --write-tree` với nhánh tích hợp hoặc giữa hai branch có exit code khác 0; git cũ hơn 2.38.
- Đọc exit code của `merge-tree`, không đọc danh sách conflict, vì docs git nói danh sách rỗng chưa chắc là sạch.
- Luôn exit 0 và in JSON (`ready`, `into`, `branches`, `problems`), cùng quy ước với hai script Jev.
- Commit chưa có trong branch thì git không thấy. Script nói rõ điều đó trong `note`, vì worktree chỉ chứa thứ đã commit.

## Files to touch
- `plugins/ccf/hooks/lib/worktree-preflight.mjs` (new), `plugins/ccf/hooks/lib/worktree-preflight.test.mjs` (new), `plugins/ccf/hooks/lib/worktree-preflight-script.test.mjs` (new)
- `plugins/ccf/scripts/worktree-preflight.mjs` (new)
- `.claude/rules/tooling.md`, `.claude/rules/architecture.md`, `CLAUDE.md`, `README.md`, `README.vi.md`, `README.zh-CN.md`, `plugins/ccf/README.md`

## Acceptance criteria
- [ ] `taskIdFromBranch` lấy id từ `worktree-ccf-<iteration>-<id>` (iteration có thể chứa `-`), trả `null` cho tên khác.
- [ ] File thật ngoài khai báo và không phải test là lỗi `out-of-scope`; file test và file khớp glob hay thư mục khai báo thì không.
- [ ] Hai branch cùng sửa một file thật là lỗi `actual-overlap`.
- [ ] Branch không có task file, task trùng, task không khai báo file đều là lỗi.
- [ ] `merge-tree` exit khác 0 với nhánh tích hợp (`merge-conflict`) hoặc giữa hai branch (`pair-conflict`) là lỗi.
- [ ] Không branch nào khớp thì `ready: false` với lỗi `no-branches`.
- [ ] Script không đổi ref, index hay working tree nào (test so `git status --porcelain` và danh sách ref trước và sau).
- [ ] Script luôn exit 0; test chạy trên repo git tạm thật.
- [ ] Số script 3 sang 4 đồng bộ mọi nơi; ba bộ test, `tsc`, `validate`, `ccf-budget` xanh.

## Results
- **RED trước:** test lib đỏ vì module chưa tồn tại; test script đỏ 5/5 khi chưa có script. Xanh sau khi viết: 12 pass (7 lib + 5 script trên repo git tạm thật, git 2.43.0).
- **Các case repo thật:** hai branch rời nhau, có file test, `ready: true`, và `for-each-ref` + `status --porcelain` + `HEAD` giống hệt trước và sau khi chạy; file ngoài khai báo + file thật chung + conflict giữa hai branch cho `out-of-scope`, `actual-overlap`, `pair-conflict`; main đổi cùng file cho `merge-conflict`; branch `999` không có task file cho `unmatched-branch`; `--branches` chọn riêng một branch; thư mục không phải git repo cho `reason: not-a-git-repo`, exit 0.
- **Gate:** lib 268 pass, 0 fail; template 8 pass; `tsc` exit 0 (lần đầu đỏ 3 lỗi `implicit any`, đã thêm JSDoc); `claude plugin validate` passed.
- **Sau `/ccf:check` (hai checker song song, lần đầu dùng cách của 063):** một `FAIL:` (spec) đã tái hiện: `git diff --name-only` đi theo rename, nên `git mv` một file ngoài khai báo vào đường dẫn đã khai báo cho `ready: true`. Sửa bằng `--no-renames`, thêm test RED rồi xanh. Một `WARN:`: đường dẫn khai báo không phân tích được lại thành "phủ mọi file" (fail-open), vì `pathsClash` trả `true`. Giờ nó không phủ gì và sinh lỗi `unparseable-declared`, có test RED rồi xanh.
- **Chưa quan sát:** chạy trên worktree thật tạo bằng `claude -w`. Test chỉ dựng branch cùng tên trong một checkout. `merge-tree --write-tree` có ghi object không được tham chiếu vào object database; ref, index và working tree không đổi.
- **Chưa làm (ngoài phạm vi):** ledger `.claude/plan/parallel/<iteration>.json`, script `integrate-wave --apply`, backtest Jev, câu hỏi opt-in ở bước plan.
