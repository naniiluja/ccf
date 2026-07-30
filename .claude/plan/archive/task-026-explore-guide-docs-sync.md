# Task 026 — Spec + docs + count sync (6 → 7 hooks)

- **Vertical slice:** đồng bộ tài liệu/đếm cho hook mới `explore-guide-inject` (không đụng code hook)
- **Depends on:** 025
- **Spec refs:** `components.md` + `git-workflow.md` (sync khi thêm hook); `hooks.md` (mẫu mô tả event); `architecture.md` (deterministic part); memory [[sync-hook-docs-both-places]]
- **Implemented by:** ccf-implementer (session sạch), then `/ccf:ccf-check` + `/code-review`
- **Test discipline:** OFF
- **Gate (một lần grep cuối, phải GREEN):**
  - grep-consistency: `7 hook` ở mọi nơi; `explore-guide-inject` + `SubagentStart` xuất hiện; KHÔNG còn `6 hook` cũ sót — sweep set: `CLAUDE.md` (numeral + danh sách prose `:17`), `architecture.md`, `hooks.json:2` description, `README.md`/`.vi`/`.zh-CN`, `plugins/ccf/README.md`
  - `claude plugin validate plugins/ccf` — accepted
  - `npx -p typescript tsc --noEmit` — exit 0
  - `node --test plugins/ccf/hooks/lib/*.test.mjs` — xanh

## Goal (one sentence)
Cập nhật mọi tài liệu/đếm để phản ánh hook thứ 7 `explore-guide-inject`, không để count-drift, đồng bộ với các iteration đang mở.

## Files to touch + nội dung
- `.claude/rules/hooks.md` — entry event `SubagentStart` mới cho `explore-guide-inject` (matcher `"Explore"`; LSP-conditional; best-effort never-block) + ghi chú array `SubagentStart` giờ có 2 hook (agent-rules-inject = no-matcher + filter nội bộ `WRITER_AGENTS`; explore-guide-inject = matcher `"Explore"`).
- `CLAUDE.md` — `6 hook`→`7 hook` + thêm `explore-guide-inject` vào **danh sách prose ở `CLAUDE.md:17`** (không chỉ sửa số) + danh sách repo-layout; refresh "Current plan".
- `.claude/rules/architecture.md` — **KHÔNG có numeral hook** (invariant `:33` chỉ cmd/agent/skill — ĐỪNG bịa "6 hooks"). Edit thật: nhắc hook `SubagentStart` thứ 2 (`explore-guide-inject`) cạnh `agent-rules-inject` quanh `architecture.md:26` (§Agent context & deterministic part).
- `hooks.json:2` `description` — thêm mệnh đề Explore-guidance (đã làm ở 025; xác nhận lại).
- `README.md` + `README.vi.md` + `README.zh-CN.md` — thêm 1 dòng bảng hook (sau dòng `agent-rules-inject`) + bump "Hooks = 6"→"7".
- `plugins/ccf/README.md` — thêm dòng cây (~line 38) + dòng mục Hooks.
- Quét `.claude/rules/*` (components/tooling) + `MEMORY.md` (pointer tùy chọn) cho mọi tham chiếu count/list còn sót.

## Independence / baseline (premortem M — count-drift, anchor 005–009)
Ba iteration đang OPEN/in-review (017–019, 020–021, 022–023) đều assert/đụng count `6 hook` trên CLAUDE.md/READMEs. Tập file CÒN LẠI rời nhau (file `.mjs` mới + entry hooks.json mới); chỗ va chạm DUY NHẤT là numeral/list count. **Rebase 026 lên đúng count mà các iteration mở để lại khi chúng land** (nếu cái nào bump count trước → 026 tăng từ đó). Làm edit count ở BƯỚC CUỐI rồi re-grep một lần.

## Acceptance criteria (verifiable)
- [ ] Mọi file trên đã sửa; một pass grep cuối: `7 hook` nhất quán, `explore-guide-inject` hiện diện, không `6 hook` sót.
- [ ] `architecture.md` được nhắc hook thứ 2 (không bịa numeral).
- [ ] `validate` + `tsc` + `node --test` xanh.

## Steps
1. Sửa `hooks.md` entry + `architecture.md` mention + `plugins/ccf/README.md`.
2. Sửa 3 README gốc (bảng + count) + `CLAUDE.md` (numeral + prose `:17` + repo-layout + Current plan).
3. Quét residual count/list; bump count ở BƯỚC CUỐI (rebase theo iteration mở).
4. grep-consistency một pass + `validate` + `tsc` + `node --test`.
5. `PLAN.md` status 026 → `in-review`.

## Notes
[[sync-hook-docs-both-places]]: mô tả hook ở CẢ `hooks.md` (spec) VÀ README (user doc) — đừng quên bên nào.
