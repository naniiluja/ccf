# Task 027 — Right-size slices principle (prose/rule edit)

- **Vertical slice:** thêm nguyên tắc "chỉ chia nhỏ khi cần" vào luật slicing của CCF (một slice prose cố kết — dogfood: KHÔNG tách doc-sync)
- **Depends on:** — (lead của iteration right-size-slices; độc lập file với các iteration mở trừ va chạm vùng-mã `architecture.md`)
- **Spec refs:** `ccf-plan.md` step 4 (SEQUENTIAL law) + step 5; `architecture.md` §Command↔agent boundary; Anthropic *"add complexity only when it demonstrably improves outcomes"* (đã dùng ở 020/025); [[user-delegates-pick-best-practice-not-complex]]
- **Implemented by:** ccf-implementer (session sạch), then `/ccf:ccf-check` + `/code-review`
- **Test discipline:** OFF (pure prose)
- **Gate (phải GREEN trước khi sang 028):**
  - grep-consistency: nguyên tắc right-size + 4 drivers hiện diện ở `ccf-plan.md`; KHÔNG xoá/mâu thuẫn luật vertical-slice cũ (diễn giải lại "thinnest→richest", không bỏ)
  - `claude plugin validate plugins/ccf` — accepted
  - `npx -p typescript tsc --noEmit` — exit 0
  - cross-read: đọc lại `ccf-plan.md` để chắc vertical-slice + sequential law còn nguyên

## Goal (one sentence)
Sửa luật slicing để plan sinh slice cỡ-PR cố kết, chỉ tách nhỏ khi có động lực thật — giảm task tí hon/latency mà không phá vertical-slice.

## Files to touch + nội dung
- `plugins/ccf/commands/ccf-plan.md` — step 4: chèn nguyên tắc right-size (xem block dưới); step 5: tinh chỉnh câu "PR-sized vertical slice" để khớp.
- `D:\ccf\.claude\rules\architecture.md` — thêm ghi chú "Slice granularity" ngắn trong §Command↔agent boundary (CCF law). **REBASE lên những gì 023/026 để lại** ở file này (nó đang bị 022/023, 020/021, 025/026 chạm — các iteration đó in-review). Va chạm vùng-mã THẬT, không trivial.
- `plugins/ccf/commands/ccf-init.md` — kiểm tra A-gate/mục slicing; đồng bộ wording right-size nếu có nhắc (chỉ sửa nếu thực sự có).
- `templates/root/.claude/**` — kiểm tra template có lặp luật slicing không; đồng bộ nếu có (nhiều khả năng KHÔNG → YAGNI, đừng tạo mới).

## Nội dung nguyên tắc right-size (chèn vào step 4 của ccf-plan.md)
> **Right-size mỗi slice.** Một slice = tăng-trưởng end-to-end nhỏ nhất nhưng vẫn CỐ KẾT, cỡ một PR có nghĩa — KHÔNG phân mảnh việc cố kết thành nhiều micro-task. Chỉ tách nhỏ hơn khi có động lực THẬT: (1) phụ thuộc dữ liệu thật giữa các phần; (2) cần một gate xanh ĐỘC LẬP (vd live-verify treo); (3) cô lập rủi ro (refactor TÁCH KHỎI feature — luật cũ giữ nguyên); (4) không vừa một context/review. Mặc định GỘP doc/spec/count-sync vào task feature cùng nó; chỉ tách doc-sync khi nó thật lớn/độc lập. (Vẫn slice VERTICAL như trên — right-size điều chỉnh ĐỘ DÀY mỗi slice, không bỏ tracer-bullet.)

## Acceptance criteria (verifiable)
- [ ] `ccf-plan.md` step 4 có nguyên tắc right-size + đủ 4 drivers + câu "gộp doc-sync mặc định".
- [ ] Luật vertical-slice + sequential + refactor-tách-feature CÒN NGUYÊN (chỉ bổ sung, không xoá).
- [ ] `architecture.md` có ghi chú slice-granularity, rebase đúng nội dung hiện hành.
- [ ] `validate` + `tsc` xanh.

## Steps
1. Sửa `ccf-plan.md` step 4 (chèn block) + step 5 (khớp wording).
2. Thêm ghi chú slice-granularity vào `architecture.md` (rebase lên nội dung 023/026 để lại).
3. Kiểm tra `ccf-init.md` + template; chỉ sửa nếu có lặp luật slicing.
4. grep-consistency + `validate` + `tsc` + cross-read.
5. `PLAN.md` status 027 → `in-review`.

## Notes
Dogfood ngay nguyên tắc: task này KHÔNG tách doc-sync — chính là một slice cố kết. KHÔNG đổi count (6/6/7/1).
