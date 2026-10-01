# Task 069 — Chạy backtest thật với Jev + cập nhật kết luận vào harness

- **Vertical slice:** live run (mạng thật, key thật) + cập nhật doc/note trong harness
- **Depends on:** 068
- **Spec refs:** `plugins/ccf/scripts/jev-slice-check.mjs` (`PARALLEL_NOTE` đang ghi "has not been backtested"), `.claude/plan/archive/task-064-worktree-parallel-research.md` mục 2c (ngưỡng 95%)
- **MCP to use:** none
- **Gate (must be GREEN before the next slice):** live run hoàn tất có số liệu thật, `PARALLEL_NOTE` mới ghi con số đo được, toàn bộ test xanh, `tsc --noEmit` exit 0

## Goal (one sentence)
Chạy backtest bằng key Jev thật trên toàn bộ corpus, ra con số recall/FPR, rồi thay câu "has not been backtested" trong harness bằng kết luận đo được và khuyến nghị có/không dùng Jev để gating song song.

## Acceptance criteria (verifiable)
- [ ] Chạy `TYPESAFE_API_KEY=<key> node plugins/ccf/scripts/jev-backtest.mjs` trên repo này hoàn tất: số batch, số cặp positive/negative, recall, FPR, per-question, unansweredRate đều là số thật in ra JSON.
- [ ] `PARALLEL_NOTE` trong `jev-slice-check.mjs` được viết lại: ghi ngày chạy, số cặp, recall đo được (ví dụ "backtested 2026-10-01 on N pairs: recall R%"), và khuyến nghị: nếu recall >= 95% thì Jev được dùng để gating, nếu không thì giữ nguyên "candidate is not proof of independence".
- [ ] Kết quả chi tiết (số liệu + 3 cặp Jev sai điển hình nhất nếu có) được ghi vào mục Notes của task file này để lưu vết cho lần archive sau.
- [ ] Không để key lọt vào log, file hay diff (script chỉ đọc từ env, report không in key).
- [ ] Toàn bộ test (`node --test plugins/ccf/hooks/lib/`, `.claude/tests/`) xanh sau thay đổi.

## Test first (write before implementing)
Không có test mới cho slice này (là live run + sửa text). Test là: chạy script với key giả mạo qua `CCF_JEV_URL` trỏ vào stub HTTP local trả answers cố định → assert JSON có đủ trường số; rồi mới chạy với key thật.

## Files to touch
- `plugins/ccf/scripts/jev-slice-check.mjs` — viết lại `PARALLEL_NOTE` bằng kết quả đo (sửa)
- `.claude/plan/task-069-jev-backtest-report.md` — ghi số liệu live run vào Notes (sửa, ở slice này)

## Steps (thin end-to-end slice)
1. Write the failing test (cover the slice's user-visible behavior, not just one layer)
2. Implement minimally across the layers the slice touches
3. Run the test / verify actual output — the gate above must be GREEN, then mark the task `in-review` (NOT `done`)
4. `/ccf:check` → `/ccf:updatespec` — `done` is set ONLY here, after the review passes

## Notes / best-practice sources
- task-064 §2c: "Đề xuất chỉ đưa Jev vào quyết định khi recall trên phụ thuộc thật từ 95% trở lên. Dưới mức đó, Jev chỉ là ý kiến tham khảo."
- Chi phí live run: khoảng 3 batch gọi Jev, key lấy từ env của coder, không hardcode.

## Live run results (2026-10-01, key thật, Typesafe API)

Lệnh: `TYPESAFE_API_KEY=<từ env> node plugins/ccf/scripts/jev-backtest.mjs` (không in key ra log/diff).

- batches: 7 (73 cặp x 3 câu hỏi, chunk 12 cặp/batch-state để vừa cap 80KB), skipped: []
- corpus: 13 positive (declared `Depends on` thật, đã strip label khỏi input) + 60 negative (seed 20261001), ungrouped 9 task (001-009, không có iteration)
- recall: 92.3% (12/13) — DƯỚI ngưỡng 95% của task 064
- FPR: 65-70% (39-42/60, dao động giữa 2 lần chạy — Jev không deterministic)
- unansweredRate: 0
- per-question (run 2): dep recall 84.6% / posRate 63.3% | contract recall 23.1% / posRate 20.0% | shared_state recall 69.2% / posRate 26.7%

Cặp Jev sai điển hình:
- False negative duy nhất: 023->025 (dep 0.19, contract 0.29, shared_state 0.27 — cả ba đều sát dưới ngưỡng 0.3, near-miss)
- False positive cao nhất: 012->032 (dep 0.57); nhiều FP có dep 0.3-0.46 như 010->017, 015->049, 013->050

Kết luận: Jev giữ vai trò advisory cho parallel gating, KHÔNG đủ tin để tự động coi "no edge" là độc lập. `PARALLEL_NOTE` đã cập nhật con số này.

Caveat quan trọng: negative labels chỉ là "không khai báo Depends on", không phải "đã chứng minh độc lập" — một phần FP có thể là phụ thuộc thật nhưng không khai báo, nên FPR đo được là cận trên.

Bug phát hiện nhờ probe trước live run:
1. `backtest-metrics.mjs` đọc `answer.p` trong khi API thật trả `{type:"noul", noul:<p>}` — production (`noulValue`) đọc đúng, metric đọc sai. Đã sửa dùng chung `noulValue`.
2. Timeout mặc định 6.5s (cho hook) quá ngắn cho backtest: batch thật timeout toàn bộ. Thêm `timeoutMs` (mặc định 120s cho backtest), probe 6 câu hỏi trả về trong 634ms.
3. `buildSliceRequests` hỏi mọi tổ hợp index pair trong state gộp (13 batch vô nghĩa cho 17 cặp). Thêm opt `pairs` để chỉ hỏi đúng cặp corpus.
4. State gộp 146 task = 200KB vượt cap 80KB. Chia chunk 12 cặp/state (~33KB).

Status: in-review (chờ /ccf:check → /ccf:updatespec mới đánh done)
