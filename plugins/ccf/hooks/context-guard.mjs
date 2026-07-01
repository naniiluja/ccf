#!/usr/bin/env node
// CCF context-guard — UserPromptSubmit. When context is over the degrade threshold, surface a
// /compact warning through BOTH systemMessage (user) + additionalContext (model) every turn —
// deterministic, not dependent on the model choosing to relay it. When wired with the --hard-block
// arg (the hooks.json entry IS the toggle), it instead exit-2 BLOCKS the prompt, with an escape
// hatch: a /compact prefix or an explicit ccf:override token still passes (warns, never blocks).
// The hint task is `findHintTask` (prefers in-progress/in-review, falls back to the next "todo"),
// NOT `findActiveTask` — so the hint stays task-specific even between finishing one task and
// starting the next, instead of degrading to generic wording just because nothing is in-progress.

import { join } from "node:path";
import { readStdinJson, emitPromptWarning, blockUserPrompt } from "./lib/io.mjs";
import {
  readContextUsage,
  shouldNudgeCompact,
  decideGuardAction,
  buildCompactHint,
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
const hint = buildCompactHint(task);
const pct = Math.round((usage.tokens / usage.windowSize) * 100);

if (action === "block") {
  const reason =
    `CCF context-guard: context ~${pct}% (${usage.tokens} tokens) is past the degrade threshold — ` +
    `the prompt is BLOCKED to protect quality. Run a focused compact first:\n  ${hint}\n` +
    `To bypass deliberately, prefix with /compact or include ccf:override in your prompt.`;
  blockUserPrompt(reason);
}

const modelContext =
  `<ccf>Context ~${pct}% (${usage.tokens} tokens) — entering the degrade zone where the model gets less sharp. ` +
  `Tell the user to run a focused compact NOW rather than waiting for auto-compact. Suggested:\n  ${hint}</ccf>`;
const userMessage =
  `CCF: context ~${pct}% — entering the degrade zone. Run a focused compact now:\n  ${hint}`;

emitPromptWarning(modelContext, userMessage);
