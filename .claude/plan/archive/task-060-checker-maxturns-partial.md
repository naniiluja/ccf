# Task 060 — `maxTurns` cho checker, và partial không bao giờ là PASS

- **Vertical slice:** agent frontmatter + checker prompt + `check.md`/`cook.md`/`updatespec.md` + `lib/verify-chain.mjs` + test + rule (`components.md`, `prompt-standard.md`)
- **Depends on:** 059
- **Spec refs:** changelog 2.1.246 ("a subagent that stops at its `maxTurns` limit now returns its output marked as partial, with a hint to continue it via `SendMessage`"); `.claude/rules/components.md:27` (lệnh cấm `maxTurns` phải gỡ); luật tool-pairing trong `prompt-standard.md`
- **MCP to use:** none
- **Gate (must be GREEN before the next slice):** quan sát partial thật được ghi lại; test mới RED rồi xanh; `node --test plugins/ccf/hooks/lib/*.test.mjs` (đếm lại số pass); `npx -p typescript tsc --noEmit`; `claude plugin validate plugins/ccf`; đo lại `wc -c`, cập nhật nhãn `ccf-budget`, `node --test .claude/tests/*.test.mjs`

## Goal (one sentence)
Checker có trần lượt rõ ràng, và một review bị cắt ngang luôn bị đọc là không sạch ở mọi nơi quyết định `done`.

## Acceptance criteria (verifiable)
- [ ] Dấu partial nguyên văn của harness được quan sát bằng `claude -p --agents '{…"maxTurns":2}'` và ghi vào file này.
- [ ] `ccf-spec-checker.md` có `maxTurns`; giá trị lấy từ trace eval (khoảng 2 lần số lượt lớn nhất), hoặc 40 kèm ghi rõ là ước lượng.
- [ ] Checker in `PARTIAL: <phần chưa xem>` khi không xem hết.
- [ ] `check.md` tiếp tục checker đúng một lần bằng `SendMessage` (có trong `allowed-tools`); nếu vẫn partial, báo cáo ghi `PARTIAL:` và kết luận không sạch.
- [ ] `cook.md` bước 3 và `updatespec.md` không ghi `done` khi có `FAIL:` hoặc `PARTIAL:`.
- [ ] `buildVerifyReason` nói rõ review `PARTIAL:` không sạch; `verify-chain.test.mjs` assert điều đó.
- [ ] Hàng `PARTIAL:` trong bảng marker của `prompt-standard.md`; lệnh cấm ở `components.md:27` được gỡ, dẫn 2.1.246.

## Test first (write before implementing)
Assert trong `verify-chain.test.mjs` rằng reason chứa `PARTIAL:`; chạy và thấy RED trước khi sửa `verify-chain.mjs`.

## Files to touch
- `plugins/ccf/agents/ccf-spec-checker.md`, `plugins/ccf/commands/{check,cook,updatespec}.md`
- `plugins/ccf/hooks/lib/verify-chain.mjs`, `plugins/ccf/hooks/lib/verify-chain.test.mjs`
- `.claude/rules/components.md`, `.claude/rules/prompt-standard.md`, và `architecture.md`/`hooks.md` nếu nhắc tới

## Notes / best-practice sources
obra/superpowers: nói rõ khi review theo từng lượt hoặc thiếu bằng chứng; claude-code `code-review`: câu kết nêu phạm vi đã kiểm.

## Results
**Quan sát partial thật (2026-09-29, Claude Code 2.1.284):** chạy `claude -p --agents '{"tiny":{...,"tools":["Read"],"maxTurns":2,"model":"haiku"}}'` trong `/tmp/partial-probe` (6 file, yêu cầu đọc mỗi lượt một file), tốn 0.083 USD. Nguyên văn đầu `tool_result` của `Agent`:
`NOTE: this agent stopped at its 2-turn limit before finishing. The text below is PARTIAL output; treat it as incomplete. Send the agent a message (SendMessage) to let it continue from where it stopped.`
- `tool_use_result.status` là `"completed"`, `is_error` là `undefined`, còn `harnessNoteCount` là 1. Metadata vì vậy không phân biệt được partial với xong; chỉ có dòng NOTE.
- Chính subagent không biết mình bị cắt: câu cuối của nó là "Now reading the second file." Vì vậy tiêu chí "checker tự in `PARTIAL:`" chỉ là tín hiệu phụ. Tín hiệu chính là dòng NOTE, do `check.md` chuyển thành `PARTIAL:`.
- Phiên cha tự tiếp tục bằng `SendMessage` 3 lần. Mỗi lần tiếp tục lại chạm trần 2 lượt, tức mỗi lần `SendMessage` nhận thêm đúng `maxTurns` lượt.

**Đã làm:**
- Test trước: assert `PARTIAL:` và `no FAIL: or PARTIAL:` trong `verify-chain.test.mjs`. Thấy RED (16 pass, 1 fail) rồi mới sửa `buildVerifyReason`, sau đó xanh.
- `cook.md` bước 3 và 4, `updatespec.md` (định nghĩa "cleanly"), `skills/plan/SKILL.md` bước sau implement: có `PARTIAL:` thì dừng, không ghi `done`.
- `prompt-standard.md`: thêm hàng `PARTIAL:` vào bảng marker.
- `components.md`: gỡ `maxTurns` khỏi danh sách cấm, kèm nguyên văn dấu partial đã quan sát và dẫn 2.1.246.
- `hooks.md`: câu về `auto-verify` nhắc `PARTIAL:`.
- `architecture.md` không nhắc `maxTurns`, nên không đổi.

**Gate đã chạy:**
- `node --test plugins/ccf/hooks/lib/*.test.mjs`: 235 pass, 0 fail.
- Test của template: 8 pass. `.claude/tests`: 10 pass.
- ccf-budget đo lại: paid = 95710.
- `tsc --noEmit`: exit 0. Máy mới không có `npm`/`npx`, nên em tải `typescript` 5.9.3 + `@types/node` 22.20.4 + `undici-types` từ registry vào `node_modules/` (đã được gitignore) và chạy `node node_modules/typescript/lib/tsc.js --noEmit -p .`.

**BỊ CHẶN, chưa làm:** `plugins/ccf/agents/ccf-spec-checker.md` và `plugins/ccf/commands/check.md` bị ghi lại lúc 14:32 với chủ sở hữu `root:root` và quyền `660` (nhiều khả năng do stash/pop chạy bằng root trên host). User `coder` không đọc hay sửa được hai file này. Vì vậy còn thiếu:
- `maxTurns: 40` trong frontmatter checker. Đây là ước lượng: trace eval không đọc được, và parent dùng 13 đến 15 lượt mỗi run.
- Dòng tự báo `PARTIAL:` trong thân checker.
- `check.md`: thêm `SendMessage` vào `allowed-tools`; nhận ra dòng NOTE của harness hoặc `PARTIAL:`; tiếp tục đúng một lần; nếu vẫn partial thì in `PARTIAL:` và kết luận không sạch.
- `claude plugin validate plugins/ccf` đỏ chỉ vì `EACCES` trên đúng hai file này; các file còn lại đều qua.
- Chưa kiểm được thay đổi 059 trong hai file có còn nguyên sau khi pop không.

**Hoàn tất sau khi quyền được sửa (2026-09-29):** đã kiểm lại, thay đổi 059 trong hai file vẫn còn nguyên sau lần pop.
- `ccf-spec-checker.md`: `maxTurns: 40` (ước lượng, xem trên); nguyên tắc "Say when you did not finish": xem file rủi ro cao trước, tự mở báo cáo bằng `PARTIAL:` khi thấy không kịp, và làm tiếp từ danh sách đó khi được gọi lại.
- `check.md`: `SendMessage` có trong `allowed-tools` (luật tool-pairing); bước 3 nhận ra dòng NOTE của harness hoặc `PARTIAL:`, tiếp tục đúng một lần, nếu vẫn partial thì dòng đầu báo cáo là `PARTIAL:` và kết luận không sạch.
- Gate: `validate` passed; hook lib 235 pass; template 8 pass; `.claude/tests` 10 pass; `tsc` exit 0; md5 7 bản khối văn phong khớp; quét codepoint 0 hit. ccf-budget không đổi (hai file này không nằm trong phần trả phí).

**Chưa quan sát:** `check.md` thật sự tiếp tục một checker bị cắt ngang (chưa chạy `/ccf:check` nào với checker chạm 40 lượt); case eval thứ 7 ép partial không làm được, vì `max_turns` của case áp cho phiên cha, không cho subagent. Bằng chứng thay thế là lần quan sát tay ở trên, trong đó phiên cha dùng `SendMessage` để tiếp tục thành công.
