# Pending — CCF

> One table for what is still waiting after a task closes: residual risks a task was `accepted` with, and actions only a human can take. It is never archived, so a row outlives the iteration that created it.
> `Kind`: `risk` (a behavior not yet observed or a known gap the owner accepted) or `action` (a step waiting on a human, e.g. a paid run or a manual check). `Status`: `open` or `closed`, written as a bare word.
> Close a row only when its `Closing evidence` exists (a captured payload, a run log, a commit), and write that evidence into the cell. The session-start hook reminds the first 5 `open` rows every session.
> `/ccf:updatespec` writes a `risk` row before it marks a task `accepted`, and closes an `action` row once its closing evidence exists.

Seeded by task 082 from `ARCHIVE.md`'s "Residual risk carried forward from the bulk-closes". Items made moot by a retirement are left out: the `SubagentStop` payload shape (038, 034a; `implementer-verify-gate.mjs` retired), the `/compact` hint wording and `--hard-block` (040, 041; `context-guard.mjs` retired), `--enforce-tests` (041; retired with its hook) and `/ccf:fix` (047; retired).

| ID | Kind | Task | What | Who | Closing evidence | Status |
|---|---|---|---|---|---|---|
| R1 | risk | 039 | Real `agent_type` value in a live `SubagentStart` payload never captured, so the `Explore` matcher of `explore-guide-inject` rests on docs only (025a) | owner | A captured `SubagentStart` payload from an installed-plugin session | open |
| R2 | risk | 041, 028a | `--auto-verify` Stop hook has never been seen running (default OFF in the shipped `hooks.json`) | owner | A transcript of one session with `--auto-verify` on that blocks once and then stops | open |
| R3 | risk | 041 | `--dual-channel-stop` has never been seen running; whether Stop `additionalContext` reaches the model is unobserved | owner | A transcript where the model restates a Stop advisory delivered through `additionalContext` | open |
| R4 | risk | 044 | Every part of task 044 is unobserved on an installed build: `/ccf:plan` step 1b's 5 set-B analyzers and the repaired `AskUserQuestion` asking in all asking commands | owner | A `/ccf:plan` run transcript from the installed plugin cache showing both | open |
| R5 | risk | 045-048 | `/code-review` never ran on the 045-048 diff (dc16fc5, c79a2a3 went straight to `main`) | owner | A `/code-review` report on that range | open |
| R6 | risk | 047 | `/ccf:init` up to A4 (the model question) never ran on a reinstalled build | owner | An `/ccf:init` transcript on a reinstalled build reaching A4 | open |
| R7 | risk | 022a | MCP inheritance by plugin subagents never observed live | owner | A subagent transcript calling a project MCP tool | open |
| R8 | risk | 029a | Agent `effort` frontmatter never observed taking effect | owner | A session log showing the per-agent effort level | open |
| R9 | risk | 030a | Kiro support (030a) never observed live | owner | A run log from a Kiro session | open |
| A1 | action | 079 | Paid `claude plugin eval` run (8 cases, 3 runs each) never run after case 08 was added | owner | The eval results summary compared with the task 058 baseline | open |
| A2 | action | 081 | Paid eval run of case 09 (`09-unruled-bug`) | owner | The eval results for case 09 | open |
