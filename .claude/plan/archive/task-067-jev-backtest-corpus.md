# Task 067 — Corpus backtest: trích xuất task lịch sử + ground truth phụ thuộc

- **Vertical slice:** lib thuần (parse + ground truth) + unit test
- **Depends on:** —
- **Spec refs:** `.claude/plan/archive/task-064-worktree-parallel-research.md` mục 2c (đề xuất backtest, ngưỡng recall 95%), `plugins/ccf/hooks/lib/slice-check.mjs` (`extractFiles`, `extractDependsOn`, `certainEdge` qua `filesOverlap`/`hotspotClasses`)
- **MCP to use:** none
- **Gate (must be GREEN before the next slice):** unit test của lib mới xanh (`node --test` trên file test), toàn bộ test lib hiện có vẫn xanh

## Goal (one sentence)
Biến 68 task file đã archive thành corpus backtest có ground truth: cặp positive là phụ thuộc thật mà code không tự bắt được, cặp negative là mẫu các cặp còn lại, và input đưa cho Jev tuyệt đối không chứa label.

## Acceptance criteria (verifiable)
- [ ] Đọc được mọi `task-NNN-*.md` trong `.claude/plan/archive/`, nhóm theo iteration bằng cách parse bảng backlog trong `ARCHIVE.md` (mỗi `## Origin` một iteration); task không gán được iteration thì bỏ qua và báo số lượng.
- [ ] Mỗi task cho ra `{ id, title, files, criteria, dependsOn }`; đồng thời cho ra bản text "input cho Jev" đã strip dòng `Depends on` (chống leak label: Jev trong production không bao giờ thấy dòng này vì `buildSliceRequests` không đưa `dependsOn` vào state).
- [ ] Tập positive: cặp (i, j) cùng iteration mà j khai `Depends on` chứa i, và `certainEdge` (bỏ qua luật declared-dependency) trả về null, tức không trùng file, không trùng hotspot, đủ file list. Đo sơ bộ được 19 cặp.
- [ ] Tập negative: mẫu ngẫu nhiên (seed cố định để tái lập) tối đa 60 cặp cùng iteration, không khai Depends on lẫn nhau, `certainEdge` null.
- [ ] Test chứng minh input gửi Jev không chứa chuỗi "depends on" (case-insensitive) ở bất kỳ cặp nào.

## Test first (write before implementing)
`plugins/ccf/hooks/lib/backtest-corpus.test.mjs`: fixture 3 task file giả (một cặp declared-dep trùng file, một cặp declared-dep khác file, một cặp độc lập) → assert tập positive chỉ chứa cặp khác file, assert input Jev sạch "depends on", assert nhóm iteration đúng. Viết test trước, chạy thấy RED, rồi implement `backtest-corpus.mjs` cho xanh.

## Files to touch
- `plugins/ccf/hooks/lib/backtest-corpus.mjs` — parse archive, nhóm iteration, strip Depends on, tính positive/negative (mới)
- `plugins/ccf/hooks/lib/backtest-corpus.test.mjs` — unit test (mới)

## Steps (thin end-to-end slice)
1. Write the failing test (cover the slice's user-visible behavior, not just one layer)
2. Implement minimally across the layers the slice touches
3. Run the test / verify actual output — the gate above must be GREEN, then mark the task `in-review` (NOT `done`)
4. `/ccf:check` → `/ccf:updatespec` — `done` is set ONLY here, after the review passes

## Notes / best-practice sources
- task-064 §2c: "backtest trên lịch sử có sẵn... đo recall của `dep_`/`contract_`. Đề xuất chỉ đưa Jev vào quyết định khi recall trên phụ thuộc thật từ 95% trở lên."
- Nguyên tắc backtest chuẩn: tách label khỏi input (không thì đo khả năng đọc chép, không phải khả năng phán đoán).
- Review 2026-10-01 (ccf-spec-checker): loader bỏ sót 5 file hậu tố `024a/025a/028a/032a/034a` (chỉ đọc 63/68). Fix: nới regex `task-(\d+[a-z]?)-`, map `| 024a |` trong ARCHIVE.md, lowercase id. Sau fix corpus 68/68 file, grouped 59, positive vẫn 13 (5 cặp hậu tố bị codeEdgeOnly loại: 3 unknown-files, 2 file-overlap).
