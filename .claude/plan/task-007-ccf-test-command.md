# Task 007 — New `/ccf-test` command (the 6th command)

- **Vertical slice:** command (new) + README + PLAN + tooling rule + cross-refs
- **Depends on:** 006 (serial queue; the command consumes the discipline placeholders set up earlier)
- **Spec refs:** `components.md` (command frontmatter: `description`/`argument-hint`/`allowed-tools` least-privilege/`model`; MCP full-namespace); `git-workflow.md` (adding a command → commands/, README command table, cross-references in other prompts); `architecture.md` (plugin.json/marketplace.json auto-discover commands — do NOT list); sibling `ccf-check.md:4` (allowed-tools shape)
- **Implemented by:** ccf-implementer + MCP none (optional ccf-best-practice-researcher for extra ISTQB cites)
- **Gate (must be GREEN before the next slice):** `claude plugin validate plugins/ccf` green; frontmatter matches sibling convention; command count 5→6 synced in EVERY listed place (README heading + table row + typical-flow line, PLAN.md count, tooling.md self-checks); no `${CLAUDE_PLUGIN_ROOT}` in markdown

## Goal (one sentence)
Add a 6th command `/ccf-test` that — for a given function/slice and only when the project opted into the test discipline — designs the EP+BVA+decision-table matrix at contract level, writes the tests (failing first), runs the project's test command, and reports actual results + coverage vs the gate.

## Acceptance criteria (verifiable)
- [ ] `plugins/ccf/commands/ccf-test.md` exists with frontmatter: `description`, `argument-hint: "[function/slice to test]"`, `allowed-tools: Read, Glob, Grep, Bash, Task` (matches `ccf-check.md`; NO MCP unless a concrete need is named), `model: opus`.
- [ ] Body has numbered steps: (0) read target `testing.md` for framework/cmd/discipline; (1) if discipline NOT opted in → report and stop; (2) design the contract-level matrix (EP+BVA+decision-table); (3) write tests per the matrix (failing first); (4) run `{{TEST_CMD}}` (the project's command); (5) report actual results + coverage vs gate, never claim "tested" without running.
- [ ] No `${CLAUDE_PLUGIN_ROOT}` in the markdown (it does not expand there).
- [ ] README: heading "The 5 commands" → "The 6 commands"; a new table row for `/ccf-test`; the "Typical flow" line (README.md:55) updated to include `/ccf-test`.
- [ ] `.claude/plan/PLAN.md` count "5 cmd" → "6 cmd".
- [ ] `.claude/rules/tooling.md` "CCF self-checks (internal commands)" gains a `/ccf-test` entry ("name — when to use — how to call").
- [ ] `ccf-plan.md`/`ccf-check.md` closing flows reference `/ccf-test` when discipline is ON.
- [ ] `claude plugin validate plugins/ccf` green.

## Test first (write before implementing)
- Command is a prompt → try-it scenario: feed a hypothetical function with one numeric param valid 1..100; expected `/ccf-test` output enumerates partitions (0 invalid, 1 min, 100 max, 101 invalid) + decision-table rows, then writes+runs tests and reports actuals. Verify by reading the prompt and dry-running in Claude Code.
- `claude plugin validate plugins/ccf` → green (6th command discovered, frontmatter valid).
- Grep all sync targets → count consistently says 6.

## Files to touch
- `plugins/ccf/commands/ccf-test.md` — NEW command (the spec above).
- `README.md` — heading 5→6, new row, typical-flow line.
- `.claude/plan/PLAN.md` — count 5→6.
- `.claude/rules/tooling.md` — self-checks entry for `/ccf-test`.
- `plugins/ccf/commands/ccf-plan.md` + `ccf-check.md` — closing-flow cross-ref to `/ccf-test` (when discipline ON).

## Steps (thin end-to-end slice)
1. Write the try-it scenario + count-consistency check as the verification target.
2. Author `ccf-test.md` matching the sibling frontmatter convention exactly.
3. Sync EVERY count/cross-ref place listed above.
4. `claude plugin validate plugins/ccf`; grep counts; dry-run the command logic.
5. `/ccf:ccf-check` → `/code-review` → `/ccf:ccf-updatespec`.

## Notes / best-practice sources
Anthropic: "give Claude a verifiable check"; have Claude run the tests and report results, not claim them (`code.claude.com/docs/en/best-practices`, `/common-workflows`). ISTQB EP/BVA/Decision Table. Frontmatter modeled on `ccf-check.md` (least-privilege, no MCP).
