# Task 028 — auto-verify Stop hook + lib + wiring + FULL doc/count sync (7 → 8 hooks)

- **Vertical slice:** hook `Stop` opt-in tự lái main loop chạy chuỗi verify khi code xong + toàn bộ doc/count-sync (doc-sync GỘP theo nguyên tắc right-size 027)
- **Depends on:** 027
- **Spec refs:** `hooks.md` (I/O contract, exit-code, event list, Stop entry); `io.mjs`; `plan.mjs#findActiveTask`; `verify-trace.mjs`; `review-trace.mjs#hasSpecCheckerReview`; `context-guard` opt-in-by-arg precedent; [[ccf-enforce-with-hook-not-prompt]], [[hook-user-visible-channel]], [[heuristic-copy-drift-smoke-reveals]]
- **Implemented by:** ccf-implementer (session sạch), then `/ccf:ccf-check` + `/code-review`
- **Test discipline:** OFF (pure lib mới VẪN bắt buộc `node --test`)
- **Gate (phải GREEN):**
  - `node --test plugins/ccf/hooks/lib/*.test.mjs` — nhóm `verify-chain` mới (decision-table `shouldDriveVerify` + `buildVerifyReason` on/off + `readDisciplineOn` on/off/file-thiếu) + baseline xanh
  - `npx -p typescript tsc --noEmit` — exit 0
  - stdin-smoke **5 ca**: (1) `enabled+in-review+edited+chưa-check` → block kèm reason; (2) không-arg → exit 0; (3) không-in-review → exit 0; (4) check-đã-chạy → exit 0; (5) `stop_hook_active=true` → exit 0
  - `claude plugin validate plugins/ccf` — accepted, KHÔNG `Duplicate hooks file detected`
  - grep-consistency: `8 hook` mọi nơi; `auto-verify` hiện diện; KHÔNG `7 hook` sót; chuỗi `description` `hooks.json:2` có mệnh đề auto-verify

## Goal (one sentence)
Thêm hook `Stop` opt-in `auto-verify.mjs` dùng ralph-loop (`decision:"block"`) để main loop tự chạy `/ccf-check → /code-review → /ccf-test (nếu discipline) → /ccf-updatespec (chỉ khi sạch)` ngay khi có task `in-review` + session đã sửa code.

## Cơ chế (grounded: Context7 `/websites/code_claude`, ralph-loop `plugins/ralph-wiggum`)
OPT-IN qua arg `--auto-verify` trong `hooks.json` (không arg → no-op `exit 0`, mặc định TẮT — giống `--hard-block` của context-guard).

`shouldDriveVerify({ enabled, stopHookActive, hasInReviewTask, editedCodeThisSession, checkAlreadyRan })` (pure) = `enabled && !stopHookActive && hasInReviewTask && editedCodeThisSession && !checkAlreadyRan`
- `enabled` ← `--auto-verify` trong argv.
- `stopHookActive` ← `input.stop_hook_active` — **guard CHÍNH trong một lần drive**.
- `hasInReviewTask` ← `plan.mjs#findActiveTask` (TÁI DÙNG) — **trigger chính**.
- `editedCodeThisSession` ← `verify-trace.mjs#readTranscriptSignals/editedAnyCodeFile` (TÁI DÙNG) — guard chống kích trong session chỉ-plan.
- `checkAlreadyRan` ← `review-trace.mjs#hasSpecCheckerReview` (TÁI DÙNG) — **guard XUYÊN-Stop** (không phải guard chính). Race chấp nhận được: một Stop không-`stop_hook_active` trước khi `/ccf-check` kịp spawn → có thể re-drive (bán kính = lặp `/ccf-check`, không phá dữ liệu) — ghi rõ trong `hooks.md`.

`readDisciplineOn(rulesDir)` (pure, MỚI — không reuse): đọc `.claude/rules/testing.md` tìm khối "Test design discipline"/`Matrix required: yes`. Bắt buộc test (on/off/file-thiếu).

`buildVerifyReason({ disciplineOn })` (pure) → reason có điều kiện: chạy IN ORDER qua SlashCommand: `/ccf:ccf-check` → `/code-review` → {`/ccf:ccf-test` nếu disciplineOn} → CHỈ KHI cả check+review sạch (không ❌) mới `/ccf:ccf-updatespec` đánh `done`; có ❌ → DỪNG + báo người dùng, KHÔNG done; nếu `/code-review` không tự gọi được → chạy phần còn lại + nhắc người dùng chạy tay.

`io.mjs#blockStop(reason, systemMessage)` (MỚI) → in `{ decision:"block", reason, systemMessage }` + `exit 0`. JSDoc đầy đủ.

## Files to touch
- `plugins/ccf/hooks/auto-verify.mjs` (mới) — I/O only; đọc stdin, gọi `verify-chain.mjs` + `blockStop`/`exit 0`. `#!/usr/bin/env node` + comment event/mechanism.
- `plugins/ccf/hooks/lib/verify-chain.mjs` (mới) — `shouldDriveVerify` + `readDisciplineOn` + `buildVerifyReason` (pure/defensive, JSDoc).
- `plugins/ccf/hooks/lib/verify-chain.test.mjs` (mới) — **failing-first**, full decision-table.
- `plugins/ccf/hooks/lib/io.mjs` — thêm `blockStop` + sửa `emitSystemMessage` JSDoc cross-ref (advisory; để BLOCK dùng `blockStop`).
- `plugins/ccf/hooks/hooks.json` — object thứ 2 trong mảng `Stop` (command KHÔNG kèm `--auto-verify` mặc định) + cập nhật top-level `description` (`:2`).
- `tsconfig.json` — xác nhận glob `hooks/**/*.mjs` đã phủ (không sửa nếu đã phủ).
- **Doc/count sync 7→8:** `CLAUDE.md` (numeral + prose `:17` + Current plan), `hooks.md` (entry Stop mới + ghi chú "**mảng Stop nay giữ HAI hook**: updatespec-nudge advisory + auto-verify BLOCKING" + bullet `blockStop` ở I/O contract + tradeoff loop-guard), `architecture.md` (nhắc hook thứ 8 — KHÔNG bịa numeral), 3 README gốc (`README.md`/`.vi`/`.zh-CN`: count + bảng hook), `plugins/ccf/README.md` (cây + mục Hooks), `hooks.json:2` description.
- Xác nhận `ccf-check.md`/`ccf-test.md`/`ccf-updatespec.md` có `description` + KHÔNG `disable-model-invocation` (precondition SlashCommand) — không sửa nếu đã đạt.

## Acceptance criteria (verifiable)
- [ ] 3 pure function + `blockStop` viết xong, test failing-first rồi xanh; 5 ca smoke đúng.
- [ ] Hook wiring opt-in (no arg → no-op); `validate` không lỗi trùng hook.
- [ ] Doc fix Stop advisory→blocking đủ 3 chỗ (hooks.md entry + blockStop bullet + io.mjs JSDoc).
- [ ] grep `8 hook` nhất quán; `tsc` + `node --test` xanh.

## Steps
1. Viết `verify-chain.test.mjs` (đỏ) → `verify-chain.mjs` + `io.mjs#blockStop` → `auto-verify.mjs` → xanh.
2. Wiring `hooks.json` Stop object 2 + description.
3. Doc fix Stop advisory→blocking (3 chỗ) + doc/count sync 7→8 (rebase count cuối cùng).
4. 5 ca stdin-smoke + `tsc` + `node --test` + `validate` + grep-consistency.
5. `PLAN.md` status 028 → `in-review`.

## Notes
Hook BLOCKING đầu tiên của CCF trên `Stop` — phải sửa tài liệu "PURELY ADVISORY" cho khớp, nếu không là spec-drift. Đếm: **+1 hook → 6/6/8/1**.
