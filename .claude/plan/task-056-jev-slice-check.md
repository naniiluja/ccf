# Task 056 — jev-slice-check script + plan skill step 4 wiring

- **Vertical slice:** pure lib + human-run script + a small SKILL.md step edit + count sync.
- **Depends on:** 055
- **Spec refs:** `architecture.md` (Script type: human-run, may reuse `hooks/lib/*`), `plan` skill step 4, `prompt-standard.md`
- **MCP to use:** none
- **Gate:** the three test suites, `tsc`, `validate`, count grep (scripts 1 to 2), re-measured `ccf-budget`

## Goal (one sentence)
After the plan skill writes its task table, a script can ask Jev which task pairs depend on each other and which tasks are fragments, and print the result as an advisory the model and user weigh.

## Acceptance criteria (verifiable)
- [ ] Pure lib builds one state (all tasks with id, title, Files, criteria) and pairwise Noul questions referencing `tasks[i]`/`tasks[j]` by path, splits them into batches (default 40), merges answers into a dependency graph plus fragment warnings; a batch failing with 4xx is skipped and reported
- [ ] Overlap of `Files:` sets is computed in code, never asked of Jev
- [ ] Script: `node <abs>/jev-slice-check.mjs [--dir <path>]` reads the task files, needs `TYPESAFE_API_KEY`, prints JSON, exits 0 with a stated reason when the key or network is missing (never blocks planning)
- [ ] `skills/plan/SKILL.md` step 5 (moved from 4: the task files must exist on disk, which is only after plan approval) calls the script when the key exists and continues normally otherwise; the skill does not change the plan on its own
- [ ] Script count 1 to 2 in CLAUDE.md, architecture.md, tooling.md, READMEs; `tsconfig.json` include covers it

## Test first
`hooks/lib/slice-check.test.mjs` (question building, batching, merge, overlap) and a process-level script case against a fake server. Confirm RED first.
