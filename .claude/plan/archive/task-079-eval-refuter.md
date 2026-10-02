# Task 079 — Eval case 08 + a "real defect is not refuted" grader

- **Vertical slice:** one new seeded eval case + a protective grader on cases 01 to 05
- **Depends on:** 078
- **Spec refs:** `.claude/rules/tooling.md` (`claude plugin eval`, case layout); `.claude/rules/testing.md` (fourth suite, latch-seen-RED lesson, task 050).
- **MCP to use:** none
- **discipline:** off
- **Gate (offline, required):** `bash scaffold.sh` builds the fixture git repo in a temp dir; every regex grader, run with node on one passing and one failing sample report, shows both GREEN and RED.

## Goal (one sentence)
The eval suite shows the refuter refutes a permitted-but-suspicious pattern and never refutes a real seeded defect.

## Changes
- Case 08: a diff with a pattern that looks wrong but a fixture rule explicitly permits (e.g. a catch swallowing `ENOENT` while cleaning a temp file, with a quotable rule). Graders: `ccf-finding-refuter` is spawned when a `FAIL:` exists; every `FAIL:` on that pattern's file carries `Refuted`.
- One new `not-refuted.md` grader in each of cases 01 to 05.

## Paid observation (non-blocking, run on a host)
`cd plugins/ccf && env -u ANTHROPIC_API_KEY claude plugin eval . --scaffold --ablation none --allow-tools Bash --runs 3 --max-cost-usd 9 --no-publish --trust-plugin`. Record in this file: 0/15 seeded defects in cases 01 to 05 refuted, recall at least 14/15, case 06 still 0 `FAIL:`, case 08 refuted in at least 2 of 3 runs.

## Acceptance criteria (verifiable)
- [ ] Case 08's scaffold builds a git fixture.
- [ ] Each new regex grader is seen RED and GREEN on sample reports.

## Files to touch
- `plugins/ccf/evals/08-permitted-pattern/case.yaml` (new)
- `plugins/ccf/evals/08-permitted-pattern/prompt.md` (new)
- `plugins/ccf/evals/08-permitted-pattern/scaffold.sh` (new)
- `plugins/ccf/evals/08-permitted-pattern/graders/*.md` (new)
- `plugins/ccf/evals/0{1,2,3,4,5}-*/graders/not-refuted.md` (new)
