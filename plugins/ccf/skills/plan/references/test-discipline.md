# Test-discipline opt-in (`/ccf:plan` step 5b)

Ask the user ONE question: **adopt the contract-level test discipline for THIS plan?** If the project's `.claude/rules/testing.md` already carries the "Test design discipline" block or `Matrix required: yes`, default to ON and just confirm; otherwise default OFF.
- **ON** → write into EACH task's gate that it must include the **contract-level matrix tests** (EP / BVA / decision-table at the function's public signature) **and an actual test run** before the gate is GREEN. Record `discipline: on` in the task file, since the matrix is designed and written as part of the failing-test-first flow when the task is implemented, and `/ccf:check` enforces it.
- **OFF** → plans behave exactly as today; gates keep the unit/integration/e2e wording from step 4 and no matrix is forced, so ship-fast is unaffected.
