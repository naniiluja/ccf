# Task 025a — Live post-reload verify (row TREO, HARD close-gate)

- **Vertical slice:** live verification (không phải task code) — xác nhận hành vi thật sau khi cài lại plugin
- **Depends on:** 026
- **Status:** todo — treo tới khi user reload plugin + quan sát thật pass
- **Spec refs:** memory [[ccf-plugin-runs-from-cache-not-repo]] (plugin active chạy từ cache → cần reload mới có hiệu lực), [[subagent-spawn-tool-named-agent]] (tên/shape harness-dependent — phải chụp dòng thật)
- **Gate (HARD close-gate):** `/ccf:ccf-updatespec` KHÔNG được ghi iteration `done` cho tới khi row này pass bằng QUAN SÁT THẬT — KHÔNG được waive bằng acceptance-without-observation (đúng failure-mode của 024a). Unit test xanh + grep-consistency là cần nhưng KHÔNG đủ.

## Goal (one sentence)
Trên harness user đang dùng, sau khi reload plugin, xác nhận agent `Explore` thật sự nhận directive đã tiêm và dùng LSP (hoặc fallback đúng khi không có server).

## Acceptance criteria (verifiable, user-driven)
- [ ] Cài lại/reload plugin để bản 025 có hiệu lực (không chạy cache cũ).
- [ ] Hỏi một câu về source thật ("tìm references của X", "X định nghĩa ở đâu") → main loop spawn `Explore`.
- [ ] Chụp dòng `SubagentStart` THẬT từ transcript `.jsonl` → xác nhận `agent_type == "Explore"` (validate matcher key — rủi ro harness-name còn lại). Nếu khác → sửa matcher bằng giá trị chụp được + thêm fixture vào `explore-guide.test.mjs`.
- [ ] Xác nhận `additionalContext` đã tiêm XUẤT HIỆN trong context của Explore subagent (không chỉ ở stdout hook).
- [ ] Quan sát Explore thật sự gọi tool `LSP` (hoặc fallback Grep/Glob đúng khi project không có language server) — worst case = no-op an toàn, không crash.

## Notes
- Đây là verify thủ công của user; main thread/`ccf-implementer` không tự chạy được (cần session tương tác thật + reload).
- Nếu `agent_type` thật ≠ `"Explore"`: cập nhật matcher + fixture + ghi `MEMORY.md` (phủ failure-mode harness-variant trong premortem).
- Lý do HARD close-gate: toàn bộ giá trị iteration là RUNTIME injection; xanh unit + grep không chứng minh hành vi thật (đúng bài học 024a để live-check treo rồi coi như xong).
