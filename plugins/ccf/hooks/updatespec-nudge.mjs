#!/usr/bin/env node
// CCF Stop nudge — Stop event, PURELY ADVISORY (never blocks).
// Composes FIVE INDEPENDENT advisories into the single non-blocking Stop channel:
//   (A) verify-work     : this SESSION edited code but ran no test command (session transcript evidence).
//   (B) updatespec      : code changed more recently than the spec (cross-history staleness, freshness.mjs).
//   (C) plan-status-sync: this SESSION ran `git commit` but PLAN.md still has tasks not 'done'.
//   (D) archive-plan    : PLAN.md holds an iteration whose every task is CLOSED — it should be retired.
//   (E) prune-archive   : archive/ holds task files of iterations older than the newest 10 in ARCHIVE.md.
// No clause gates another; all off → emit nothing, exit 0.
// Channel: default is emitSystemMessage (user-facing only, SINGLE channel — must stay INVARIANT).
// Opt-in via a `--dual-channel-stop` argv flag → emitStopAdvisory (BOTH additionalContext + systemMessage,
// per Claude Code 2.1.163's Stop additionalContext support). Same toggle pattern as auto-verify's
// --auto-verify: the hooks.json command line IS the toggle. Default OFF —
// hooks.json does NOT carry this flag, so the single-channel path stays the shipped behavior.

import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readStdinJson, emitSystemMessage, emitStopAdvisory, RELAY_IN_USER_LANGUAGE } from "./lib/io.mjs";
import { specsOlderThanCode } from "./lib/freshness.mjs";
import { needsVerifyNudge, readTranscriptSignals } from "./lib/verify-trace.mjs";
import { findNonDoneTasks } from "./lib/plan.mjs";
import { committedThisSession } from "./lib/git-trace.mjs";
import { findRetirableIterationsIn, findPrunableTaskFilesIn } from "./lib/archive.mjs";

/** Clause (E) keeps the task files of this many newest archived iterations; the script's default. */
const PRUNE_KEEP_ITERATIONS = 10;

const input = await readStdinJson();

// Avoid loops: if this Stop was triggered by a previous Stop hook, bail out.
if (input.stop_hook_active) {
  process.exit(0);
}

const cwd = String(input.cwd ?? process.cwd());
const projectRoot = resolve(cwd);
const rulesDir = join(cwd, ".claude", "rules");

// Only nudge for CCF-managed projects (those with .claude/rules).
if (!existsSync(rulesDir)) {
  process.exit(0);
}

// Two-channel model (task cc-2.1.220-realign): each clause pushes ONE
// { directive, userNote } pair into `advisories`, instead of two hand-synced parallel arrays
// (`directiveParts`/`userParts`, pre-cc-2.1.220-realign) — a future clause D can no longer push to
// one array and silently forget the other. `directive` is an INSTRUCTION for the model (composed
// into additionalContext when dual-channel is on — the model relays it IN THE USER'S OWN LANGUAGE,
// since a hook cannot know what language the user is writing in); `userNote` is a short, neutral,
// DATA-only fact for the user (systemMessage, both channels). The two must carry DIFFERENT content —
// a hook must never hand the user a raw model-facing directive written in hardcoded English.
/** @type {{ directive: string, userNote: string }[]} */
const advisories = [];

// (A) Verify-work — SESSION evidence (best-effort transcript read, never throws).
// NOTE: clause (A) and clause (C) each scan the transcript independently (readTranscriptSignals vs
// committedThisSession) — a deliberate ~2x read, NOT an oversight. The cost is negligible (<10ms on a
// typical transcript, well inside the 10s hook timeout) and keeping verify-trace (code-edits/test-runs)
// separate from git-trace (commits) is the correct SRP boundary. Fuse only if transcripts get huge.
const transcriptPath = String(input.transcript_path ?? "");
if (needsVerifyNudge(readTranscriptSignals(transcriptPath))) {
  advisories.push({
    directive: `<ccf>You edited code this session but no test/verification command ran. Tell the user, ${RELAY_IN_USER_LANGUAGE}, that their work should be verified (tests / type-check) before considering the task done.</ccf>`,
    userNote: "code was edited this session with no test/verification command run yet — verify your work (run the tests or a type-check) before stopping",
  });
}

// (B) Updatespec — spec-vs-code staleness across history (independent of A).
if (specsOlderThanCode(cwd, rulesDir)) {
  advisories.push({
    directive: `<ccf>Code changed this session but the spec wasn't updated. Tell the user, ${RELAY_IN_USER_LANGUAGE}, to run /ccf:check then /ccf:updatespec to keep context fresh for future sessions.</ccf>`,
    userNote: "the spec looks older than the code changed this session — run /ccf:check then /ccf:updatespec to keep context fresh",
  });
}

const planFile = join(cwd, ".claude", "plan", "PLAN.md");

// (C) Plan-status-sync — committed this session but PLAN.md still has unfinished tasks (independent of A/B).
if (committedThisSession(transcriptPath)) {
  const pending = findNonDoneTasks(planFile);
  if (pending.length > 0) {
    const ids = pending.map((t) => t.id).join(", ");
    advisories.push({
      directive: `<ccf>You committed code this session but PLAN.md still has ${pending.length} task(s) not 'done' (ids ${ids}). Tell the user, ${RELAY_IN_USER_LANGUAGE}, to mark each 'done' only after its /ccf:check passes, or to fix its status.</ccf>`,
      userNote: `PLAN.md still has ${pending.length} task(s) not 'done' (ids ${ids}) — mark each done only after its /ccf:check passes, or fix its status`,
    });
  }
}

// (D) Archive-plan — PLAN.md holds an iteration whose every task row is CLOSED (independent of A/B/C).
// Detection is deterministic and harmless here; the actual retirement REWRITES two files and moves
// task files, so it is deliberately NOT done by this hook — it is left to `scripts/archive-plan.mjs`,
// which a human runs. Detection-vs-action split: the hook is certain about the fact, the human owns
// the mutation.
// The script path is resolved from import.meta.url rather than from `cwd`, because the plugin runs
// from its installed cache copy, not from this repo — a cwd-relative path would not exist there.
const retirable = findRetirableIterationsIn(planFile);
if (retirable.length > 0) {
  const scriptPath = fileURLToPath(new URL("../scripts/archive-plan.mjs", import.meta.url));
  const command = `node "${scriptPath}" --dir "${projectRoot}" --apply`;
  const count = retirable.length;
  advisories.push({
    directive: `<ccf>PLAN.md still holds ${count} iteration(s) whose every task is closed. Tell the user, ${RELAY_IN_USER_LANGUAGE}, that a closed iteration left in PLAN.md is counted as live work by the plan hooks, and that running \`${command}\` retires it into ARCHIVE.md (task files into archive/). Mention they can run it without --apply first to preview.</ccf>`,
    userNote: `${count} fully-closed iteration(s) still in PLAN.md — retire with: ${command} (drop --apply to preview first)`,
  });
}

// (E) Prune-archive — archive/ holds task files of iterations older than the newest 10 in ARCHIVE.md
// (independent of A-D). Same detection-vs-action split as (D): deleting files is left to the
// human-run `scripts/prune-archive.mjs`, which reads the same findPrunableTaskFilesIn decision.
const prunable = findPrunableTaskFilesIn(join(cwd, ".claude", "plan"), PRUNE_KEEP_ITERATIONS).prune;
if (prunable.length > 0) {
  const scriptPath = fileURLToPath(new URL("../scripts/prune-archive.mjs", import.meta.url));
  const command = `node "${scriptPath}" --dir "${projectRoot}"`;
  const count = prunable.length;
  advisories.push({
    directive: `<ccf>.claude/plan/archive/ holds ${count} task file(s) of iterations older than the newest ${PRUNE_KEEP_ITERATIONS} in ARCHIVE.md. Tell the user, ${RELAY_IN_USER_LANGUAGE}, that running \`${command}\` previews which files would be pruned (ARCHIVE.md and git history keep the record), and that adding --apply stages their removal with git rm without committing.</ccf>`,
    userNote: `${count} archived task file(s) belong to iterations older than the newest ${PRUNE_KEEP_ITERATIONS} — preview with: ${command} (then add --apply)`,
  });
}

// Fold all advisories; silent if none. Channel picked by the opt-in flag.
if (advisories.length > 0) {
  const directive = advisories.map((a) => a.directive).join("\n");
  const userMessage = `CCF: ${advisories.map((a) => a.userNote).join("; ")}.`;
  const dualChannel = process.argv.includes("--dual-channel-stop");
  if (dualChannel) {
    emitStopAdvisory(directive, userMessage);
  } else {
    emitSystemMessage(userMessage);
  }
}

process.exit(0);
