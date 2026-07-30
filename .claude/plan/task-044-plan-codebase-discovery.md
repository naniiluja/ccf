# Task 044 — /ccf:plan discovers the codebase with 5 analyzers, not Explore

**Status:** in-review
**Depends on:** 043 (serial law only; the two touch no common file)
**Model:** opus (main loop, no implementer spawn — user asked directly)

## Origin
User asked for `/ccf:plan` to fan out 5 agents like `/ccf:init` does, instead of using the built-in
`Explore` agent for codebase discovery.

**The premise needed correcting first, and it was corrected to the user before any edit:** `/ccf:plan`
did not use `Explore` anywhere. It had NO codebase-discovery step at all. It read `CLAUDE.md` +
`.claude/rules/*` + `PLAN.md` (step 1), then went straight into the `grill-me` interview (step 2),
which probes code with `Read`/`Glob`/`Grep` **in the main conversation** — its `allowed-tools` has no
`Task`, so it never spawned anything. Any `Explore` the user saw was the MAIN LOOP choosing to spawn
it, because `plan.md` lists `Task` in `allowed-tools` with nothing forbidding it. So this task ADDS a
step and FORBIDS `Explore`; it does not replace an existing mechanism.

User was offered two shapes and chose: **planning-oriented slices** (over reusing init's five
project-survey slices) and **always run, skip only on greenfield** (over asking every time).

## What was built
- `agents/ccf-codebase-analyzer.md` — the agent previously hardcoded exactly init's five slices. Now
  it declares TWO sets: **set A** (onboarding, unchanged) and **set B** (planning, new): impact
  surface / patterns to conform to / existing test surface / integration points & dependencies /
  blast radius & fragility. Each set has its own report format; set B's adds a **mandatory Unknowns
  section**. Also added an LSP-first navigation principle (matters most for set B slices 1 and 5),
  and rewrote `description` so it no longer reads as init-only.
- `commands/plan.md` — new **step 1b**, placed between step 1 and the interview so its reports FEED
  the interview (confirm instead of asking blind; each Unknown is a candidate question). 5 parallel
  spawns, `run_in_background: false` on all 5, all five given the same requested-change context.
  Explicitly forbids spawning `Explore` and forbids a main-loop broad sweep, while still allowing
  targeted reads. Greenfield skip must be STATED, never silent.

## Correction after the first version shipped (user-reported)
The first version of step 1b told the model to STATE a default model instead of asking, on the
grounds that `plan.md` had no `AskUserQuestion` in `allowed-tools`. **That was the wrong fix
direction and it was wrong in practice**: the user ran it, got `sonnet` spawned without being asked,
and reported it. Two separate defects behind one symptom:
1. **The instruction was written to fit a missing tool.** The right move was to ADD `AskUserQuestion`
   to `allowed-tools` (done, in both `plan.md` and `init.md`), not to downgrade the behavior. A
   missing tool is a packaging defect; matching the behavior to it makes the bug permanent.
2. **A pre-existing, wider bug was uncovered**: `init.md`, `fix.md` and `cook.md` each already
   carried a paragraph saying "ask the user once which model… if `AskUserQuestion` is unavailable,
   use the frontmatter default", while NONE of the six commands listed `AskUserQuestion`. Since
   `allowed-tools` is a whitelist, every one of those three questions had been silently taking the
   fallback branch for as long as the paragraphs existed. It hid because
   `skills/grill-me/SKILL.md` has its OWN allowlist that DOES include the tool, so interviews asked
   normally and only questions asked OUTSIDE the skill were dead.

Fixed here: `AskUserQuestion` added to `plan.md` + `init.md` (the two analyzer fan-outs, i.e. the
user's actual request), step 1b and `init.md` B1 both rewritten to ASK with **`haiku` labelled as the
recommendation** and an explicit ban on silently reusing the session's own model, and the rule
written into `components.md` so it cannot recur. **`fix.md` (debugger model) and `cook.md`
(implementer model) are still broken** — same one-line defect, different feature, deliberately left
for the user to approve rather than widened into unrequested scope.
- Spec sync, 6 places that claimed only init fans out: `init.md` (the "ONLY place" sentence, plus
  labelling its list as set A), `architecture.md`, `plugins/ccf/README.md` tree, and the agent table
  in all 3 READMEs.
- **Drift caught from task 043**: `plugins/ccf/README.md`'s tree was missing both `scripts/` and
  `lib/archive.mjs`. 043's sync pass had missed that file entirely. Fixed here.

## Design decisions worth keeping
1. **Set B slices are scoped to the requested change, not a project survey.** Reusing init's five
   slices would scan the frontend for a backend-only change and still have no slice answering "what
   will this change touch". A planner needs impact + precedent + gate command + boundaries + risk.
2. **Step 1b runs BEFORE the interview, not after.** The interview's own rule is "explore before you
   ask"; giving it 5 reports first turns blind questions into confirmations, and the Unknowns
   sections are the highest-value questions left.
3. **The ban on `Explore` is not about safety.** Both are read-only fan-out. The reason is ownership:
   CCF does not own `Explore`'s prompt (a harness artifact — which is exactly why
   `explore-guide-inject` must inject guidance from outside at spawn), so it cannot be given a fixed
   report shape nor a mandatory Unknowns section. `Explore` stays fine for ad-hoc use.
4. **Reports are input, not output.** Step 1b forbids pasting reports into the plan body; facts get
   folded into task files (files to touch, gate commands) with the analyzers' evidence paths cited.

## Gate — actually run, results below
- `claude plugin validate plugins/ccf` → Validation passed.
- `node --test plugins/ccf/hooks/lib/*.test.mjs` → 227 pass, 0 fail (unchanged; this task touches no
  `.mjs`, so an unchanged count is the correct expectation, not a skipped gate).
- `npx -p typescript tsc --noEmit` → exit 0.
- `grep` verification: every remaining `Explore` mention in `commands/`+`agents/` reviewed —
  `init.md:8` is Anthropic's "Explore → Plan" workflow NAME, not the agent, so it was deliberately
  left alone. `allowed-tools` of all 6 commands audited for `AskUserQuestion` (0 of 6 had it — see
  the correction section above).

## NOT verified — the honest gap
No `/ccf:plan` run has been executed against this new step. Everything above is prompt text plus
static checks; whether 5 set-B analyzers actually return useful, non-overlapping reports is
UNOBSERVED. This is the same class of gate as 038-041's unobserved captures. Verifying it needs one
real `/ccf:plan` on a non-trivial change, checking: no `Explore` spawn appears, all 5 reports return
before the interview, and the Unknowns sections are populated rather than "none" across the board.

## Cost, stated not hidden
`/ccf:plan` now spawns up to **7** subagents per run (5 analyzers + optional
`ccf-best-practice-researcher` + mandatory `ccf-spec-checker`), against 1-2 before. Well inside the
20-concurrent / 200-per-session ceilings, but it is a real token increase on every plan, and the
analyzers default to `haiku`/`low` partly for that reason.
