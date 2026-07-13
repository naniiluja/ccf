# Task 032 — Lệnh `/cook` (orchestrator tuần tự → batch-verify)

- **Vertical slice:** file mới `commands/cook.md` + wire `ccf-plan` step 8 + entry `tooling.md` + count sync 6→7 command (một command cố kết end-to-end; nửa verify gánh rủi ro nhưng là 1 file `.md` nên fold hợp lệ).
- **Depends on:** 031 (chặn nested-spawn trước khi `/cook` spawn implementer hàng loạt).
- **Spec refs:** `.claude/rules/components.md` (§Command), `.claude/rules/tooling.md` (CCF self-checks), `.claude/rules/hooks.md` (`auto-verify.mjs`), `ccf-plan.md` step 8, plan `~/.claude/plans/hi-n-t-i-c-v-n-zesty-pancake.md`.
- **Implemented by:** `ccf-implementer` (alias `sonnet`), session sạch + MCP `context7` (re-ground alias `sonnet`→Sonnet 5 + SlashCommand/Skill-tool + `/simplify` fan-out trước khi ghi con số/cơ chế).
- **Gate (must be GREEN before task 032a):** `claude plugin validate plugins/ccf` nhận `/cook` + grep-consistency (`7 command` trên doc SỐNG; grep `6 command`=0 hit CHỈ trên doc sống, LOẠI TRỪ `task-*.md` + PLAN.md "Closed"/narrative; `/cook` ở plan/tooling/README) + đọc lại `cook.md` (allowed-tools tối thiểu, không dựa SlashCommand, có mục quan hệ `auto-verify.mjs` + re-gate sau simplify) + `npx -p typescript tsc --noEmit` + `node --test` baseline.

## Goal (one sentence)
Tạo `/cook`: sau `/ccf-plan`, một lệnh chạy tuần tự toàn bộ backlog bằng `ccf-implementer` (Sonnet 5, gate xanh từng slice), rồi batch-verify (2 read-only song song → re-gate sau simplify → updatespec), loại-trừ với `auto-verify.mjs`.

## Acceptance criteria (verifiable)
- [ ] NEW `plugins/ccf/commands/cook.md`, frontmatter: `description`, `argument-hint: "[optional: task range]"`, `allowed-tools: Read, Glob, Grep, Task, Skill` (KHÔNG SlashCommand), `model: opus`.
- [ ] Body theo 8 bước trong plan: (1) đọc PLAN.md; (2) vòng lặp tuần tự spawn implementer alias `sonnet`, slice ĐỎ → DỪNG; (3) batch-verify song song `ccf-spec-checker` (Task, cap ≤3) + `/code-review` (Skill, đòn bẩy effort); (4) `/simplify` (Skill) chạy MỘT MÌNH sau; (5) **re-gate deterministic** (`tsc`+`node --test`+`validate`) sau simplify TRƯỚC updatespec, có ❌/đỏ→DỪNG; (6) fallback nhắc-tay nếu Skill/SlashCommand không expose; (7) mục quan hệ loại-trừ với `auto-verify.mjs` (+ điều kiện guard chỉ suppress ở nhánh spawn-được); (8) nhắc `/compact` + backlog nhỏ.
- [ ] `cook.md` ghi rõ: "≤3 agent" chỉ áp cho CCF-tự-spawn (`ccf-spec-checker`); built-in `/code-review`/`/simplify` fan-out nội bộ chỉnh qua `effort`, không cap bằng số (`/simplify` cố định 4).
- [ ] `ccf-plan.md` step 8: thêm dòng gợi ý chạy `/cook` để thực thi cả backlog (đặt cạnh khuyến nghị fresh-session hiện có, KHÔNG xoá nó — `/cook` là lựa chọn tiện lợi, fresh-session-per-task vẫn là mặc định chất lượng).
- [ ] `.claude/rules/tooling.md` "CCF self-checks": thêm entry `/cook` (when-to-use — chạy cả backlog + batch-verify; loại-trừ `--auto-verify`).
- [ ] Count sync **6→7 command** trên doc SỐNG: `CLAUDE.md` numeral + `.claude/rules/architecture.md:36` invariant + `README.md`(+`.vi`/`.zh-CN`) + `plugins/ccf/README.md` + `AGENTS.md:14` + `4rum.md:91`. KHÔNG sửa `task-*.md`/PLAN.md "Closed" (point-in-time record).
- [ ] `.claude/plan/PLAN.md`: mark 032 `in-review` khi xong.

## Test first (write before implementing)
Thuần markdown → "test first" = viết trước lệnh verify, xác nhận FAIL trước khi pass.
1. `claude plugin validate plugins/ccf` — sau khi thêm `cook.md` vẫn exit 0 (nhận command mới).
2. `grep -rn "6 command" CLAUDE.md README.md plugins/ccf/README.md AGENTS.md 4rum.md .claude/rules/architecture.md` — trước: có hit; sau: 0 hit (chỉ trên tập doc SỐNG này, KHÔNG grep `task-*.md`/PLAN.md).
3. `grep -rln "cook" plugins/ccf/commands/ .claude/rules/tooling.md` — sau: `cook.md` + tooling.md có mặt.

## Files to touch
- `plugins/ccf/commands/cook.md` — NEW
- `plugins/ccf/commands/ccf-plan.md` — step 8 thêm gợi ý `/cook`
- `.claude/rules/tooling.md` — entry `/cook`
- `.claude/rules/architecture.md` — invariant 6→7 command
- `CLAUDE.md` — numeral + "Current plan" sync
- `README.md` (+ `.vi`/`.zh-CN` nếu có) — count + command table
- `plugins/ccf/README.md` — count + tree
- `AGENTS.md` — dòng "6 slash commands" → 7 (light touch; nếu 030 đang rewrite thì re-grep sau)
- `4rum.md` — "6 command" → 7
- `.claude/plan/PLAN.md` — mark 032 `in-review`

## Steps (thin end-to-end slice)
1. Re-ground: Context7 — (a) alias `sonnet` hiện resolve model nào; (b) SlashCommand tool có luôn expose không; (c) `/simplify` fan-out (4 agent?) + `/code-review` đòn bẩy effort. Ghi drift.
2. Chạy verify command trên trạng thái hiện tại, xác nhận FAIL.
3. Viết `cook.md` (8 bước, allowed-tools tối thiểu, không SlashCommand, mục auto-verify + re-gate).
4. Wire `ccf-plan.md` step 8 + `tooling.md` entry.
5. Count sync 6→7 trên tập doc SỐNG; chạy grep `6 command`=0 hit + `claude plugin validate` + `tsc` + `node --test` baseline.
6. Mark 032 `in-review`.
7. `/ccf:ccf-check` → `/code-review` → `/ccf:ccf-updatespec` — `done` chỉ set ở đây; KHÔNG đóng iteration khi `032a` còn mở.

## Notes / best-practice sources
- Context7 `/websites/code_claude` `/model-config` (alias), `/commands` (`/simplify` 4-agent), `/env-vars` (concurrency 10), `/skills` + `/cli-reference` (SlashCommand/skill invocation). Point-in-time — re-verify per step 1.
- Memory: [[slashcommand-tool-not-always-exposed]], [[ccf-enforce-with-hook-not-prompt]], [[user-delegates-pick-best-practice-not-complex]], [[ground-claude-facts-primary-not-blog]].
