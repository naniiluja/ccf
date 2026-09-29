#!/usr/bin/env node
// CCF plan-skill-inject — in plan mode, nudge the model toward the `ccf:plan` skill.
// Event: UserPromptSubmit. Mechanism: additionalContext (non-blocking); never blocks a prompt.
// Why a hook: bare `/plan` is Claude Code's built-in and a plugin skill cannot take that name, so
// plan mode itself is the trigger. The skill's `description` is the prompt-side backup.
// Removing this hook's entry from hooks.json turns the behavior off.
// Best-effort: ANY error exits 0 (we must never break or delay a prompt).

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readStdinJson, emitContext } from "./lib/io.mjs";
import { parseJsonl } from "./lib/review-trace.mjs";
import {
  shouldInjectPlanSkill,
  isCcfSlash,
  hasPlanSkillRun,
  planInjectMarkerPath,
  buildPlanSkillDirective,
} from "./lib/plan-trigger.mjs";

try {
  const input = await readStdinJson();
  const mode = String(input.permission_mode ?? "");
  const cwd = String(input.cwd ?? process.cwd());
  const managed = existsSync(join(cwd, ".claude", "plan"));
  const slash = isCcfSlash(String(input.prompt ?? ""));

  // Cheap gates first: outside plan mode (the common case) no file beyond this is touched.
  if (mode !== "plan" || !managed || slash) process.exit(0);

  const marker = planInjectMarkerPath(String(input.session_id ?? ""));
  if (!marker) process.exit(0); // no session id → cannot dedupe → stay silent
  const alreadyInjected = existsSync(marker);
  if (alreadyInjected) process.exit(0); // skip the transcript read on every later plan-mode prompt

  let skillAlreadyRan = false;
  try {
    const transcriptPath = String(input.transcript_path ?? "");
    if (transcriptPath) skillAlreadyRan = hasPlanSkillRun(parseJsonl(readFileSync(transcriptPath, "utf8")));
  } catch {
    // unreadable transcript means "not yet run"
  }

  if (shouldInjectPlanSkill({ mode, managed, isCcfSlash: slash, alreadyInjected, skillAlreadyRan })) {
    // Write the marker BEFORE emitting (emitContext exits). If it cannot be written we would nudge
    // on every prompt, so a failed write means silence instead.
    writeFileSync(marker, "1");
    emitContext("UserPromptSubmit", buildPlanSkillDirective());
  }
} catch {
  // best-effort: never break a prompt
}
process.exit(0);
