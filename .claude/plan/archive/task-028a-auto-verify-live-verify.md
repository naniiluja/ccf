# Task 028a — Live post-reload verify (HARD close-gate, treo)

- **Vertical slice:** quan sát hành vi auto-verify THẬT sau khi reload plugin — riêng biệt vì `/code-review` auto-invocation = evidence-pending (right-size driver 2+3: gate độc lập / cô lập rủi ro)
- **Depends on:** 028
- **Spec refs:** `auto-verify.mjs` + `verify-chain.mjs` (028); evidence-pending `/code-review` qua SlashCommand; [[ccf-plugin-runs-from-cache-not-repo]]
- **Implemented by:** NGƯỜI DÙNG lái (không phải ccf-implementer) — cần session tương tác thật + reload
- **Test discipline:** OFF
- **Gate (HARD — không waivable):** xem dưới

## Goal (one sentence)
Chứng minh trên harness thật: bật `--auto-verify` + reload → session implementer thật tới `in-review` → Stop → main loop TỰ chạy `/ccf-check` (+ `/code-review` nếu được), có ARTIFACT transcript làm chứng.

## Steps
1. User thêm `--auto-verify` vào entry `auto-verify.mjs` trong `hooks.json` của plugin ĐÃ CÀI (cache), reload Claude Code.
2. Chạy một task implementer thật tới khi `PLAN.md` có task `in-review` + session đã sửa code.
3. Để session Stop → quan sát main loop có tự gọi `/ccf:ccf-check` và `/code-review` không.
4. Chụp transcript (`.jsonl`) đoạn Stop + lệnh tự chạy.
5. Nếu `/code-review` KHÔNG tự gọi được → xác nhận nhánh fallback trong `reason` hoạt động (nhắc người dùng chạy tay) → vẫn graceful, ghi nhận giới hạn.

## Acceptance criteria (HARD close-gate)
- [ ] Quan sát THẬT: transcript cho thấy `/ccf-check` tự chạy sau Stop (kèm `/code-review` nếu harness cho phép).
- [ ] Transcript đã chụp được **COMMIT làm fixture** (chứng cứ, không chỉ "đã quan sát").
- [ ] Nếu `/code-review` không tự gọi → fallback-nhắc xác nhận hoạt động + giới hạn ghi vào Closed.

## Close-gate (NGUYÊN VĂN — chống lặp lại thất bại 024a)
**NOT waivable by acceptance-without-observation.** Task này giữ KHÔNG-`done` tới khi có ARTIFACT transcript commit. Lý do: 024a đã ghi đúng câu chống-waiver trong gate mà VẪN bị đóng bằng "user acceptance, live behavior UN-OBSERVED" (PLAN.md:40) → lần này mitigation-trên-giấy không đủ, bắt buộc commit fixture mới đóng. `/ccf:ccf-updatespec` KHÔNG được đóng iteration auto-verify-chain khi 028a còn mở.

## Notes
Plugin chạy từ cache → sửa repo không hiệu lực tới khi reload ([[ccf-plugin-runs-from-cache-not-repo]]). Gate trong-repo của 028 chỉ là unit/smoke; hành vi thật neo ở đây.
