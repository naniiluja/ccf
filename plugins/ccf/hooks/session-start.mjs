#!/usr/bin/env node
// CCF session-start hook — inject the context-first reminder + a freshness signal.
// Matcher: startup|clear|compact (re-inject after compact/clear).
// The recovery half of the compact-aware mechanism: after compact, re-load the in-progress task from PLAN.md.

import { existsSync } from "node:fs";
import { join } from "node:path";
import { readStdinJson, emitContext } from "./lib/io.mjs";
import { specsOlderThanCode } from "./lib/freshness.mjs";
import { findInProgressTask } from "./lib/plan.mjs";

const input = await readStdinJson();
const cwd = String(input.cwd ?? process.cwd());
const source = String(input.source ?? "");

const planDir = join(cwd, ".claude", "plan");
const planFile = join(planDir, "PLAN.md");
const rulesDir = join(cwd, ".claude", "rules");
const hasClaudeMd = existsSync(join(cwd, "CLAUDE.md"));
const managed = existsSync(planDir) || hasClaudeMd;

let msg =
  "<ccf>This project follows the CCF (Claude Context First) workflow: context-first, spec-driven, " +
  "STRICTLY SEQUENTIAL (one task at a time, no parallel feature development). " +
  "Ground every design decision in Context7 + Microsoft Learn. Keep CLAUDE.md/.claude always fresh.";

if (!managed) {
  msg += " This project is NOT yet CCF-initialized — run /ccf:ccf-init to start.</ccf>";
  emitContext("SessionStart", msg);
}

// --- Already CCF-managed ---

// Freshness signal: spec older than code → nudge updatespec.
if (specsOlderThanCode(cwd, rulesDir)) {
  msg +=
    " The spec looks older than the code — consider running /ccf:ccf-updatespec to refresh context.";
}

// Re-load the in-progress task after compact/clear.
if (source === "compact" || source === "clear") {
  const task = findInProgressTask(planFile);
  if (task) {
    msg +=
      ` You were mid-way through task ${task.id}: ${task.title}.` +
      ` Read .claude/plan/ (task ${task.id}) to resume exactly where you left off instead of re-reading everything.`;
  }
}

msg += "</ccf>";
emitContext("SessionStart", msg);
