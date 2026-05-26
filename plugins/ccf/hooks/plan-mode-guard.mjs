#!/usr/bin/env node
// CCF plan-mode guard — enforces that /ccf-plan only runs when the session is in plan mode.
// Event: UserPromptSubmit (because the command is a prompt, not a tool call).
// Deterministic mechanism: read permission_mode from stdin; if not "plan" → block (exit 2).

import { readStdinJson, blockUserPrompt } from "./lib/io.mjs";

const input = await readStdinJson();
const prompt = String(input.prompt ?? "");

// Only intervene on the ccf-plan command (both namespaced and bare forms). Ignore every other prompt.
const isCcfPlan = /(^|\s)\/ccf:ccf-plan(\s|$)|(^|\s)\/ccf-plan(\s|$)/.test(prompt);
if (!isCcfPlan) {
  process.exit(0);
}

const mode = String(input.permission_mode ?? "");
if (mode === "plan") {
  process.exit(0); // in plan mode → allow
}

// Not in plan mode → block decisively and guide the user.
blockUserPrompt(
  "CCF: /ccf-plan requires plan mode. Enter plan mode (press Shift+Tab to cycle to 'plan', " +
    "or start with --permission-mode plan) and re-run /ccf:ccf-plan. " +
    "Planning must be read-only and reviewed before execution.",
);
