# Implementation Plan — CCF (multi-iteration backlog; lead iteration at top)

> **Execution rule: STRICTLY SEQUENTIAL.** Do exactly one task at a time, in order.
> These tasks are slices sequenced for serial execution (thinnest → richest). Each `Depends on` = the prior task in the queue (serial law), unless a real data dependency is noted.
> Do not start task N+1 until task N's **gate is GREEN** (implemented + tested + checked).
> The `in-progress`/`in-review` status is read by the session-start hook to re-load context after compact — keep status up to date.

> **Scope of this file: the CURRENT iteration only.** Closed iterations and their postmortems live in
> `.claude/plan/ARCHIVE.md`; their task files live in `.claude/plan/archive/`. Keep it that way — a
> closed row left here is counted as live work by `lib/plan.mjs` (`findActiveTask` / `findNonDoneTasks`)
> and by the Stop nudge. When an iteration closes, move its `## Origin` / backlog / `## Closed`
> sections into `ARCHIVE.md` verbatim and `git mv` its task files into `archive/`.
> **Premortem note:** `ccf-spec-checker` and `/ccf:plan` step 6 anchor failure modes to real past
> iterations, so they must read `ARCHIVE.md` as well as this file.

## Origin: review-quality (task 058 đến 062)

Người dùng muốn nâng khả năng review của CCF. Plan cũ mất khi máy chủ bị thay, nên plan này làm lại với phạm vi đã duyệt gồm 4 mục: báo cáo checker (confidence và ngưỡng, danh sách không flag, quote rule trước FAIL, mục Declined to judge), eval harness bằng `claude plugin eval`, `maxTurns` cùng partial result không bao giờ là PASS, và đồng bộ changelog Claude Code 2.1.215 đến 2.1.284 vào spec. Quyết định của người dùng: eval trước để có baseline, suite 6 case x 3 runs, Jev xác minh từng FAIL (chỉ chú thích, không hạ mức), discipline off. Không commit, không tạo branch, không bump version khi chưa được yêu cầu. Kế hoạch chi tiết và nguồn: `~/.claude/plans/plan-t-i-mu-n-c-i-lucky-lerdorf.md`. Đính chính phạm vi gốc: `omitClaudeMd` ra ở 2.1.271, `background: false` cho skill `context: fork` ra ở 2.1.218.

## Task backlog — review-quality (in execution order)
| # | Slice | Layers | Gate (tests green) | Depends on | Status |
|---|-------|--------|--------------------|-----------|--------|
| 058 | Eval harness 6 case + đo baseline checker hiện tại | `plugins/ccf/evals/` + `.gitignore` + tooling.md + testing.md | smoke case trả lời 4 unknown + grader thấy RED + baseline recall/false positive ghi lại + đo lại ccf-budget | — | done |
| 059 | Báo cáo checker: rubric tin cậy, không flag, quote rule, Declined to judge | ccf-spec-checker.md + check.md + prompt-standard.md | eval không tụt so với baseline + grader mới RED trên checker cũ + md5 khối văn phong + validate | 058 | done |
| 060 | `maxTurns` + `PARTIAL:` không bao giờ là PASS | checker + check.md + cook.md + updatespec.md + verify-chain lib/test + components.md + prompt-standard.md | quan sát partial thật + test RED rồi xanh + ba bộ test + tsc + validate + ccf-budget | 059 | in-review |
| 061 | Jev xác minh từng FAIL (chú thích, không hạ mức) | lib finding-verify + script jev-verify-findings + test + check.md + đồng bộ số script 2 sang 3 | ba bộ test + tsc + validate + lần chạy có key hoặc ghi "chưa quan sát" | 060 | in-review |
| 062 | Đồng bộ changelog còn lại vào spec | tooling.md + components.md + architecture.md + CLAUDE.md | mỗi câu có số phiên bản + grep hết câu sai + ccf-budget | 061 | in-review |

> 058 và 059 đóng theo lệnh người dùng (không qua `/ccf:check`); phần gate chưa quan sát ghi trong task file của từng task. 059: eval bị confound vì git hỏng trong sandbox host.

> Status: `todo` / `in-progress` / `in-review` / `done` / `blocked`. Lifecycle: `todo → in-progress → in-review → done`. Chỉ `/ccf:updatespec` ghi `done`, sau `/ccf:check`.
