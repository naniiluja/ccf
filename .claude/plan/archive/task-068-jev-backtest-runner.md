# Task 068 — Runner backtest Jev + tính metric recall/FPR

- **Vertical slice:** lib metric thuần + script CLI gọi Jev + unit test
- **Depends on:** 067
- **Spec refs:** `plugins/ccf/hooks/lib/slice-check.mjs` (`buildSliceRequests`, `mergeSliceAnswers`, `EDGE_THRESHOLD = 0.3`), `plugins/ccf/hooks/lib/jev-client.mjs` (`askJev`, inject được `fetchImpl`), `plugins/ccf/scripts/jev-slice-check.mjs` (mẫu CLI: batch, `--dir`, đọc `TYPESAFE_API_KEY`)
- **MCP to use:** none
- **Gate (must be GREEN before the next slice):** unit test RED→GREEN với mock Jev, `tsc --noEmit` exit 0, toàn bộ `node --test plugins/ccf/hooks/lib/` xanh

## Goal (one sentence)
Hỏi Jev đúng 3 câu Noul của production (`dep_`, `contract_`, `shared_state_`) trên từng cặp corpus của 067 rồi tính recall trên positive và tỉ lệ báo nhầm trên negative, theo đúng ngưỡng và luật fail-closed của production.

## Acceptance criteria (verifiable)
- [ ] Câu hỏi dựng bằng `buildSliceRequests` trên task đã strip Depends on (đúng format production: state `{id, title, files, acceptance_criteria}`, question id `dep_i_j` / `contract_i_j` / `shared_state_i_j`), batch theo `DEFAULT_BATCH_SIZE`.
- [ ] `askJev` được gọi qua seam inject được (`fetchImpl` hoặc wrapper), để test không cần mạng; script đọc key từ `TYPESAFE_API_KEY`, thiếu key thì báo `{ ok: false, reason: "no-key" }` như `jev-slice-check`.
- [ ] Một cặp được tính là "predicted dependent" khi bất kỳ câu nào trong 3 câu có `p >= EDGE_THRESHOLD (0.3)`; cặp `unanswered` (thiếu câu trả lời hoặc batch lỗi) cũng tính là predicted dependent theo fail-closed, nhưng báo riêng tỉ lệ unanswered.
- [ ] Metric thuần trong lib: `recall = TP/(TP+FN)` trên positive, `fpr = FP/(FP+TN)` trên negative, tách riêng recall từng câu hỏi (`dep_` riêng, `contract_` riêng, `shared_state_` riêng), kèm số cặp và số batch.
- [ ] Script in JSON một dòng report: `{ ok, positives, negatives, recall, fpr, perQuestion, unansweredRate, batches }`, exit 0 luôn (như jev-slice-check, lỗi không được chặn).

## Test first (write before implementing)
`plugins/ccf/hooks/lib/backtest-metrics.test.mjs`: cho metric ăn answers giả (mock) trên 4 cặp mẫu (1 TP, 1 FN, 1 FP, 1 TN + 1 cặp unanswered) → assert recall = 0.5, fpr = 0.5, unansweredRate = 0.2, perQuestion tách đúng. Viết trước cho RED, implement `backtest-metrics.mjs` cho xanh. Thêm test cho script với `fetchImpl` mock trả answers cố định → assert JSON report có đủ trường.

## Files to touch
- `plugins/ccf/hooks/lib/backtest-metrics.mjs` — tính recall/FPR/per-question thuần (mới)
- `plugins/ccf/hooks/lib/backtest-metrics.test.mjs` — unit test (mới)
- `plugins/ccf/scripts/jev-backtest.mjs` — CLI chạy backtest (mới)

## Steps (thin end-to-end slice)
1. Write the failing test (cover the slice's user-visible behavior, not just one layer)
2. Implement minimally across the layers the slice touches
3. Run the test / verify actual output — the gate above must be GREEN, then mark the task `in-review` (NOT `done`)
4. `/ccf:check` → `/ccf:updatespec` — `done` is set ONLY here, after the review passes

## Notes / best-practice sources
- task-064 §2c: cái giá của false independence (chạy song song sai) lớn hơn false dependence (mất cơ hội song song), nên ngưỡng song song phải thấp (0.3) và unanswered là fail-closed.
- Không gửi source code cho Jev, chỉ id/title/files/criteria, như production.
- Review 2026-10-01 (ccf-spec-checker): 2 fix — (1) khối `isMain` bọc try/catch, lỗi in `{ok:false, reason:"error"}` và exit 0 như jev-slice-check; (2) report thêm `positives`/`negatives` top-level cho khớp criterion (trước đó chỉ có `stats.positivePairs`/`stats.negativeSample`).
