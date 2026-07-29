#!/usr/bin/env node
// CCF context-guard — UserPromptSubmit. When context is over the degrade threshold, surface a
// /compact warning through BOTH systemMessage (user) + additionalContext (model) every turn —
// deterministic, not dependent on the model choosing to relay it. When wired with the --hard-block
// arg (the hooks.json entry IS the toggle), it instead exit-2 BLOCKS the prompt, with an escape
// hatch: a /compact prefix or an explicit ccf:override token still passes (warns, never blocks).
// The hint task is `findHintTask` (prefers in-progress/in-review, falls back to the next "todo"),
// NOT `findActiveTask` — so the hint stays task-specific even between finishing one task and
// starting the next, instead of degrading to generic wording just because nothing is in-progress.
//
// Task 040 split: detecting "over threshold" is DETERMINISTIC (the hook's job, kept below,
// UNCHANGED). Composing the actual /compact wording is JUDGMENT — only the model, reading its own
// transcript, knows what THIS session really did (which files, if any, were modified; whether any
// test ran) and what language the user is writing in. So this hook no longer builds a canned
// /compact command: it emits plain facts to the user (systemMessage) and an INSTRUCTION to the
// model (additionalContext) to compose the command itself, in the user's own language. This also
// resolves the language problem for free — a hook has no way to know what language the user is
// using, but a model replying in the user's language is simply normal behavior.

import { join } from "node:path";
import { readStdinJson, emitPromptWarning, blockUserPrompt, RELAY_IN_USER_LANGUAGE } from "./lib/io.mjs";
import {
  readContextUsage,
  shouldNudgeCompact,
  decideGuardAction,
  normalizeHintTask,
} from "./lib/context-usage.mjs";
import { findHintTask } from "./lib/plan.mjs";

const input = await readStdinJson();

const usage = readContextUsage(String(input.transcript_path ?? ""));
if (!usage) process.exit(0); // can't read context → stay silent (never break a session)

const hardBlock = process.argv.includes("--hard-block");
const promptText = String(input.prompt ?? "");
const isEscape =
  /^\/compact/i.test(promptText.trim()) || /ccf:override/i.test(promptText);

const aboveThreshold = shouldNudgeCompact(usage.tokens, usage.windowSize);
const action = decideGuardAction({ aboveThreshold, hardBlock, isEscape });
if (action === "silent") process.exit(0);

const cwd = String(input.cwd ?? process.cwd());
const task = findHintTask(join(cwd, ".claude", "plan", "PLAN.md"));
const pct = Math.round((usage.tokens / usage.windowSize) * 100);
const hintTask = normalizeHintTask(task); // pure data only: { id, title } | null — no canned wording, see header note
// NOTE: `findHintTask` may fall back to the first "todo" task when none is in-progress/in-review
// (see plan.mjs) — so the note must NOT hardcode "in-progress", which would misdescribe a todo task.
const taskNote = hintTask ? ` (task ${hintTask.id}: ${hintTask.title})` : "";

// composeClause is an INSTRUCTION FOR THE MODEL ("compose it YOURSELF") — valid only in WARN mode,
// where a model turn actually follows and can act on it. In BLOCK mode, `blockUserPrompt` is
// `exit 2` on UserPromptSubmit: the prompt is refused BEFORE any assistant turn runs, so there is no
// model available to carry out "compose the /compact command yourself" — that instruction was
// previously reused verbatim in the block reason too (a correctness bug: dead instructions with no
// actor left to execute them, cc-2.1.220-realign fix). The block path below now speaks DIRECTLY to
// the user instead, telling them to run /compact themselves.
const composeClause =
  `Tell the user, ${RELAY_IN_USER_LANGUAGE}, that a focused /compact would help. Then compose the ` +
  `/compact command YOURSELF based on what THIS session has actually done so far. Do NOT reuse a ` +
  `fixed/canned template, and do NOT claim to preserve modified files or test commands unless they ` +
  `truly exist.`;

if (action === "block") {
  const reason =
    `CCF context-guard: context ~${pct}% (${usage.tokens} tokens) is past the degrade threshold — ` +
    `this prompt was BLOCKED to protect quality.${taskNote} No assistant turn ran, so nothing here ` +
    `composed a /compact command for you: please run /compact yourself now, describing what THIS ` +
    `session actually changed (files touched, tests run, if any) so nothing important is lost. ` +
    `To bypass deliberately instead, prefix your next prompt with /compact or include ccf:override.`;
  blockUserPrompt(reason);
}

// additionalContext: an INSTRUCTION for the model, not a ready-made command — only the model knows
// the user's language and what this session actually did (files touched, tests run, if any).
const modelContext =
  `<ccf>Context ~${pct}% (${usage.tokens} tokens) — entering the degrade zone where the model gets ` +
  `less sharp.${taskNote} ${composeClause}</ccf>`;
// systemMessage: a short, neutral, DATA-only note for the user — just the numbers + recommendation.
// No compact-command sample here; the model relays it via additionalContext above, in-language.
const userMessage = `CCF: context ~${pct}% (${usage.tokens} tokens) — entering the degrade zone.${taskNote} A focused /compact is recommended now.`;

emitPromptWarning(modelContext, userMessage);
