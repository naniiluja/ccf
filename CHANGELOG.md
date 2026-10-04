# Changelog

## 0.15.1

| case | pass | mean score | cost |
| --- | --- | --- | --- |
| 01-missing-criterion | 3/3 | 1.00 | $1.43 |
| 02-boundary-error | 3/3 | 1.00 | $1.34 |
| 03-scope-creep | 0/3 | 0.75 | $1.27 |
| 04-rule-violation | 3/3 | 1.00 | $1.45 |
| 05-swallowed-error | 3/3 | 1.00 | $1.40 |
| 06-clean-diff | 3/3 | 1.00 | $1.25 |
| 07-scope-only | 0/3 | 0.50 | $1.32 |
| 08-permitted-pattern | 3/3 | 1.00 | $1.22 |
| 09-unruled-bug | 0/3 | 0.75 | $1.37 |

Run 2026-10-04T14-58-58-440Z (claude 2.1.289, 9 cases x 3 runs, 2200s, $12.06, not partial). Case 08 passes 3/3 (`all-refuted`) on real checker output, which confirms the grader fix that had only been verified offline. With a working Bash sandbox, cases 03, 07 and 09 have valid numbers for the first time: 03 `found-defect` 0/3, 07 `found-defect` and `attributed-to-scope` 0/3, 09 `reproduced-bug` 3/3 but `found-defect` 0/3.

## 0.15.0

eval: not run: no paid claude plugin eval run on 0.15.0; newest results cover 7 of 9 cases

## 0.14.0

eval: not run: no paid claude plugin eval run on 0.14.0; the newest evals/results run (2026-10-02T02-42-07-846Z, plugin 0.13.3) covers 7 of the 9 current cases (missing 08-permitted-pattern, 09-unruled-bug) and every run errored before starting because that host could not create a shell sandbox
