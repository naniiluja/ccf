---
description: Use only when the user explicitly asks to run the planned backlog, because it merges branches and commits. Executes the todo/in-progress backlog in parallel waves, one worktree-isolated agent per task, merge each wave through the preflight gate and integrate-wave, then run /ccf:check once and /ccf:updatespec.
argument-hint: "[optional: task range]"
allowed-tools: Read, Edit, Glob, Grep, Task, Skill, AskUserQuestion, TaskCreate, TaskUpdate, TaskList, Bash
model: opus
---

You are running CCF `/ccf:cook`. You are the **wave orchestrator**: once `/ccf:plan` has produced a backlog, you split it into waves of tasks that code proves independent, run every task of a wave at the same time in its own worktree-isolated agent, and merge each wave through a mandatory gate before the next wave starts. You write application code yourself only for a task `plan-waves.mjs --inline` marked `inline` (step 4a0); every other task is written by an agent inside its own worktree and only there.

**Mutually exclusive with `auto-verify.mjs --auto-verify`:** you drive the same verify step that hook drives, so only one of the two may be active. Step 8 has the details.

## 0a. Style for user-facing text (applies to every step below that writes text for the user)
**Scope boundary:** this rule governs the text you show the user (the wave list, the per-wave result, the stop-and-report message). It does NOT apply to the CCF repo's own source, which stays English per `.claude/rules/components.md` (never translate the repo itself). Marker words, section headings and identifiers stay verbatim in every language, because the verify step parses them.
- Write in the SAME language the user is using in this conversation; never mix two languages inside one sentence.
- Keep identifiers verbatim (file names, function names, variable names, command names, field names, event names) — translating an identifier makes it wrong.
- Translate a concept when the user's language has a natural equivalent; keep a difficult or ambiguous English term verbatim and add a short parenthetical explanation on first use.
- No em dash; use a comma, colon, or parentheses instead.
- One idea per sentence; split a sentence longer than two lines.
- A language that uses diacritics (e.g. Vietnamese) must keep them; never write bare ASCII when the language needs marks.
- Do not invent abbreviations; if one is used, spell it out on first use.
- Open with the point itself; never with generic filler. End when the content ends; never restate what was just said as a summary.
- Cut adjectives that add no information; a claim earns its adjective with a concrete fact, number, or name.
- Use as many bullets as there are real points, never a rounded count; prefer plain prose when ideas are not parallel.
- Prefer a specific example, number, or name over an abstract description; give one clear recommendation instead of an option list with no conclusion; state uncertainty plainly.
- Vary sentence length; do not repeat the same key phrase within a paragraph.
- No icons or emoji in generated text; review markers use the word set FAIL:/WARN:/PASS:.

## 1. Read the backlog
Read `.claude/plan/PLAN.md` plus the relevant `.claude/plan/task-NNN-*.md` files. `PLAN.md` holds the CURRENT iteration; closed iterations live in `.claude/plan/ARCHIVE.md` and are never eligible. Select the `todo` and `in-progress` tasks; if `$ARGUMENTS` names a task range, restrict to it.

Locate the CCF scripts once with Glob (`**/ccf/scripts/plan-waves.mjs`, and its siblings `worktree-preflight.mjs` and `integrate-wave.mjs` in the same directory), because `${CLAUDE_PLUGIN_ROOT}` is not reliable in a command body.

## 2. Compute the waves
Run `node "<scripts>/plan-waves.mjs" --tasks <selected ids, comma-separated>` from the project root. It prints JSON: `waves` (each entry a list of `{ id, title, taskFile, worktree, branch }`), `edges` and `iteration`. Code decides every edge: a declared `Depends on`, a declared file clash after brace and glob expansion, a task with no `Files to touch`, an unparseable path, or two tasks on one hotspot class (lockfile, migration, shared config, `CLAUDE.md`, `.claude/rules/*`). Each of those puts the later task in a later wave, so missing or unreadable data always means "run after", never "run beside".

- **Jev may only veto.** When `TYPESAFE_API_KEY` is set, add `--jev`, and say in one sentence that task ids, titles, `Files to touch` and criteria (no source code) go to `api.typesafe.ai`. Jev's `dependency`, `contract` and `shared-state` answers can only add edges, and a pair it leaves unanswered becomes an `unanswered` edge. A Jev "no" never removes an edge code found.
- **Jev may route a small task inline, never the reverse.** When `TYPESAFE_API_KEY` is set, also add `--inline`, and say in one sentence that each eligible task's title, goal, `Files to touch` with their current line counts and criteria (no source code) go to `api.typesafe.ai`. Code first rules a task out (`Touches UI: yes`, no file list, more than 3 files, a brace or glob path); Jev then scores each remaining task, and only a score of 0.7 or more gives it `mode: "inline"`. Every other outcome (no key, an API error, a timeout, a payload over 80KB, a missing answer, a low score) leaves `mode: "worktree"`, the old behavior; `modeReason` says which. The split is advisory: you may still send an `inline` task to a worktree, never a `worktree` task inline.
- A `worktree` or `branch` of `null` means the task id cannot name a branch (letters and digits only); a `worktree`-mode task with it cannot run, so stop and tell the user to rename it.
- Show the waves, one line per wave, with each task's `mode`, and the edge that separates each later task.

### 2b. Mirror the waves into the session task list
Call **`TaskList`** first, since an earlier run may have left entries to reuse or clean rather than duplicate. Then **`TaskCreate`** one entry per selected task and use `addBlockedBy` via `TaskUpdate` to encode each edge, so the wave order is visible in the list and not only in this prompt.

- **The session task list is EPHEMERAL and is not the plan.** `.claude/plan/PLAN.md` stays the single source of truth across sessions. The session list runs `pending → in_progress → completed`, `PLAN.md` runs `todo → in-progress → in-review → done`; a merged task reaches `completed` in the list but only `in-review` in `PLAN.md`, because only `/ccf:updatespec` may write `done`.
- **`TaskCreate` / `TaskUpdate` / `TaskList` are NOT the `Task` spawn tool** despite the shared prefix. If the harness does not expose them (`CLAUDE_CODE_ENABLE_TASKS=0`), skip this sub-step, say so in one line, and track progress from `PLAN.md` alone. Never fall back to `TodoWrite`.

## 3. Preconditions and one confirmation
1. **Git:** the project must be a git repository with git 2.38 or newer (`git --version`), because the preflight reads `git merge-tree --write-tree`. Otherwise stop and say why.
2. **`.gitignore`:** make sure it lists `.claude/worktrees/`, adding the line with Edit if missing, so the agents' worktrees never show up as untracked files in the main checkout.
3. **Test command:** find the command that runs the project's whole test suite (the task gates, `.claude/rules/testing.md`, `package.json` scripts). `integrate-wave.mjs` runs it after every merge.
4. **Ask once with `AskUserQuestion`**, one call with two questions:
   - Confirm the waves, the test command, and that this run commits on the current branch: one base snapshot now (only if the tree has changes), one `--no-ff` merge commit per worktree task, one commit per inline task, and one `PLAN.md` status commit per wave. Nothing is pushed. CCF commits only with the user's consent, and a worktree sees only committed files, so without the snapshot the agents would start without the plan.
   - Which model the task agents run. Recommend the session's own model, since each agent implements a whole task with no one to ask; offer `sonnet` as the cheaper choice for small, well-specified tasks. Accept an alias only, never a dated model ID.
   - If `AskUserQuestion` is unavailable, stop and tell the user: this run commits, so it cannot proceed on a default.
5. After a yes, commit the base snapshot if needed (`git add -A && git commit -m "chore(plan): base snapshot for /ccf:cook"`), then record `BASE=$(git rev-parse HEAD)`.

## 4. Run one wave
Take the first wave that still has open tasks. `TaskUpdate` each of its entries to `in_progress`.

### 4a0. Inline tasks first, in this session
Implement each `mode: "inline"` task of the wave yourself, one at a time, on the current branch, following the brief below from step 2 onward (no branch switch, no worktree). Commit only its `Files to touch` plus their tests with `git commit -m "<id>: <title>"`, so the tree is clean before step 4d. A red gate, or a change that turns out to need a file outside `Files to touch`, is a `RED:` for the wave: STOP as in step 4b. Wave members are proven independent, so the worktree agents need none of these commits. A wave with no `worktree`-mode task skips steps 4a to 4d.

### 4a. Spawn one agent per worktree task, all in ONE message
Spawn one `Task` per `mode: "worktree"` task of the wave in a SINGLE message, so they run at the same time. Each call carries `subagent_type: "general-purpose"`, `isolation: "worktree"`, `run_in_background: false`, the model from step 3, and the brief below with the placeholders filled. `isolation: "worktree"` gives each agent its own checkout under `.claude/worktrees/`, so no two agents ever write the same working tree. `run_in_background: false` keeps you waiting for every report, since a background spawn returns an ack, not the result.

Do not tell the agents to call `EnterWorktree` or `ExitWorktree`. Observed on Claude Code 2.1.285: from a subagent, `EnterWorktree(name)` and `ExitWorktree` are refused ("it would mutate the parent session's process-wide working directory"), and after `EnterWorktree(path)` Bash refuses every command outside the agent's own isolation worktree. The harness-made worktree also starts from `origin/<default-branch>`, not from local HEAD, which is why the brief creates the task branch at an explicit base.

<agent-brief>
You implement exactly ONE task of a CCF plan, inside the isolated git worktree that is your current working directory. Other agents implement other tasks in parallel in their own worktrees; the main session merges your branch after you finish.

Task: {{ID}}, task file `{{TASK_FILE}}`. Branch: `{{BRANCH}}`. Base commit: `{{BASE}}`.

1. Run `git switch -c {{BRANCH}} {{BASE}}`, then `git branch --show-current`. If it does not print `{{BRANCH}}`, stop and report `BLOCKED:`. Work only in this directory: do not `cd` elsewhere, do not switch branches again, do not call EnterWorktree or ExitWorktree.
2. Read the task file (goal, acceptance criteria, `Files to touch`, the test to write first, the gate), `CLAUDE.md` and `.claude/rules/*`.
3. If the task file records `discipline: on`, design the contract-level EP/BVA/decision-table matrix for the public signature first and write the tests from it.
4. Write the failing test first and run it to confirm it is red.
5. Implement the minimum that turns it green and meets the acceptance criteria. Build only what the criteria require: no speculative abstraction, no refactor the task did not ask for. Change only the files under `Files to touch` plus their tests; leave `PLAN.md`, other task files, `CLAUDE.md` and `.claude/rules/*` alone unless they are listed, because the merge gate rejects any other file.
6. Run the gate command the task file names and read the real result. If the task file records `Touches UI: yes`, then run the slice for real (start the app, exercise the changed screen) and fill `Runtime evidence` in your OWN task file as `<command/step> -> <observed result>`, or verbatim `not run: <reason>` when you cannot run it. This is the one exception to leaving task files alone, because the preflight blocks the merge while that field is empty.
7. On GREEN only: `git add` the changed files and `git commit -m "{{ID}}: {{TITLE}}"`. Never push, merge, rebase or reset.
8. Reply with one first line, then the evidence:
   - `GREEN: {{ID}} {{BRANCH}} <commit sha>`
   - `RED: {{ID}} <failing test or criterion>`
   - `BLOCKED: {{ID}} <what stopped you>`
   Then the exact test command and its result, and the files you changed.
</agent-brief>

### 4b. Read the reports
Wait until every agent of the wave has reported. A reply that is only an "Async agent launched" ack is not a report; wait for the completion notification instead of reading it as done.
- **Any `RED:` or `BLOCKED:`, or a report without one of the three first lines** → **STOP the run.** Merge nothing from this wave, report each task's line to the user, and leave the worktrees in place so the work can be inspected. Leave those session entries `in_progress`, because a red task is unfinished work.
- **All `GREEN:`** → continue.

### 4c. Preflight gate (mandatory, read-only)
Run `node "<scripts>/worktree-preflight.mjs" --branches <this wave's branches, comma-separated>`. It checks each branch's real changed files against its task's `Files to touch` plus tests, that no two branches changed the same file, that a `Touches UI: yes` task has a filled `Runtime evidence` (`missing-runtime-evidence` otherwise), and that `git merge-tree` finds no conflict against HEAD or between any pair. **`ready: false` → STOP**, report every entry of `problems`, and merge nothing. Never merge around a failed preflight; `integrate-wave.mjs` runs the same gate again itself and refuses too.

### 4d. Merge and test the merged result
Run `node "<scripts>/integrate-wave.mjs" --branches <same list> --test "<test command>" --apply`. It re-runs the preflight, merges each branch with `git merge --no-ff` in wave order, runs the whole test suite after EACH merge, and only when every merge stayed green removes each worktree (`git worktree remove`, never `--force`) and deletes its branch (`git branch -d`). The tests on the merged result are the only check that catches a semantic conflict, because `merge-tree` sees text only.
- **`ok: false`** → **STOP.** Report `failed.branch`, `failed.stage` (`merge` or `test`) and the tail of `failed.output`. On a red test the script has already reset HEAD to the last green merge; say which tasks are merged and which are not.
- **`ok: true`** → report `merged` and anything listed under `kept` (a worktree or branch git refused to remove). Then delete the harness's leftover `worktree-agent-*` branches with `git branch -d` (never `-D`; report a refusal instead).

### 4e. Record the wave
Write `in-review` (a bare word, never `done`) into the `PLAN.md` status cell of each merged or inline-committed task, `TaskUpdate` its entry to `completed`, and commit `PLAN.md` alone (`chore(plan): wave <n> in-review`). Then set `BASE=$(git rev-parse HEAD)` and return to step 4 for the next wave, so it starts from the merged result.

## 5. Verify: a single `/ccf:check`
Once every selected task is `in-review`, run **`/ccf:check`** once over the whole run's diff (Skill tool, or instruct the user to run it). A per-task review cannot see a defect that only appears once the waves are combined, so the review runs on the merged result.
- **If it reports a `FAIL:` finding or a `PARTIAL:` line**, **STOP here** and report it to the user; do not run `/ccf:updatespec`. `PARTIAL:` means the review was cut off before it covered the whole diff, so its silence on the rest proves nothing.
- **If the project opted into the test discipline** (`.claude/rules/testing.md` carries the "Test design discipline" block or `Matrix required: yes`, and the task files record `discipline: on`): `/ccf:check` itself confirms the contract-level matrix tests pass as part of its own step 5.
- `/code-review` remains a good optional extra, not part of this mandatory chain.

## 6. `/ccf:updatespec`
**Only if** step 5 came back clean (no `FAIL:` finding and no `PARTIAL:` line), invoke `/ccf:updatespec` to mark the tasks `done`. **Any `FAIL:` or `PARTIAL:` anywhere → STOP, report to the user, and leave every task at `in-review`.**

## 7. Fallback when Skill or SlashCommand is not exposed
When a call for `/ccf:check` or `/ccf:updatespec` fails or the tool is absent, **tell the user explicitly** which step could not be auto-invoked, and hand them the order to run by hand (`/ccf:check` → `/ccf:updatespec`).

## 8. Relationship with `auto-verify.mjs`
`/ccf:cook` and the opt-in `auto-verify.mjs` Stop hook drive the SAME verify step, so run one or the other:
- When you use `/ccf:cook`, leave `--auto-verify` out of `hooks.json`, or the step gets driven twice.
- When `/ccf:cook` DID run `/ccf:check` (step 5), the hook's `checkAlreadyRan` / `hasSpecCheckerSpawn` guard sees the `ccf-spec-checker` spawn in the transcript (spawned, not necessarily finished) and suppresses a redundant drive at Stop.
- In the **manual-fallback branch** (step 7), no such spawn happened, so the hook re-driving the step at Stop is correct: it picks up exactly the work `/ccf:cook` could not finish.

## 9. Context management
Implementation happens in the agents' contexts, so this session carries only the wave list, the reports and the script output. Keep a run to one iteration's backlog anyway: a red wave stops the run, and a shorter queue stops earlier.

**Optional secondary stop condition:** if the official `/goal` command is available, the user may set `/goal all selected tasks are in-review`. A STOP in step 4 or 5 still ends the run, whatever the goal says.

## Notes
- Code is written by the step 4a agents, each inside its own `isolation: "worktree"` checkout, and by you only for a step 4a0 `inline` task. The CCF agents stay read-only (`ccf-codebase-analyzer`, `ccf-best-practice-researcher`, `ccf-spec-checker`, `ccf-scope-checker`, `ccf-spec-writer`); a task agent is the built-in `general-purpose` agent with the brief above.
- A wave of one task runs the same way; there is no separate sequential path.
