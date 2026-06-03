# Task 024a — Live post-reload verify (row TREO)

- **Vertical slice:** live verification (không phải task code) — xác nhận hành vi thật sau khi cài lại plugin
- **Depends on:** 024
- **Status:** todo (hanging — cần user reload plugin + một session thật). Mẫu theo 022a / 017's held live-check.
- **Spec refs:** memory [[subagent-spawn-tool-named-agent]] (shape transcript tùy harness/OS), [[ccf-plugin-runs-from-cache-not-repo]] (active plugin chạy từ cache → cần reload mới có hiệu lực)
- **Gate:** live check pass — `/ccf:ccf-updatespec` KHÔNG được ghi iteration `done` cho tới khi row này pass (lịch sử 012–014/017 từng để live-check treo rồi coi như xong)

## Goal (one sentence)
Trên harness user đang dùng, xác nhận sau `/compact` thật thì hook context-guard hết cảnh báo "vượt ngưỡng" ngay lập tức, và cảnh báo trở lại khi context lớn lại — chứng minh fix đúng và không tắt vĩnh viễn.

## Acceptance criteria (verifiable, user-driven)
- [ ] Cài lại plugin (reload) để bản sửa của 024 có hiệu lực (không chạy từ cache cũ).
- [ ] Trong session thật: đẩy context > ngưỡng (banner cảnh báo xuất hiện) → chạy `/compact` → gõ prompt kế → **KHÔNG còn banner cảnh báo** ngay sau compact.
- [ ] Vài lượt sau, nếu context lại vượt ngưỡng → banner cảnh báo trở lại (không tắt vĩnh viễn).
- [ ] Chụp dòng `compact_boundary` THẬT từ transcript của harness đó; đối chiếu predicate hẹp.

## Notes
- **Biến thể đã biết** (Context7): transcript sub-agent dùng metadata camelCase `compactMetadata`/`preTokens` — nhưng đó ở field METADATA mà code đã chủ ý NGỪNG đọc; `type:"system"` + `subtype:"compact_boundary"` snake-stable ở cả 3 nguồn doc. Khi đối chiếu chỉ cần xác nhận `subtype` còn đúng literal `compact_boundary` — KHÔNG nới predicate vì casing metadata.
- Nếu shape `subtype` khác doc trên harness thật → cập nhật predicate + thêm fixture THẬT vào `context-usage.test.mjs` + ghi `MEMORY.md` (phủ failure-mode harness-variant trong premortem).
- Đây là verify thủ công của user; main thread/`ccf-implementer` không tự chạy được (cần session tương tác thật + reload).
