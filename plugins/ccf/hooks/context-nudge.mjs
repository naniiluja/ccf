#!/usr/bin/env node
// CCF context-nudge — PostToolUse, PURELY ADVISORY (never blocks).
// Reads transcript token usage; if context exceeds ~40% of the model window (the "dumb zone"),
// nudge Claude to propose a proactive /compact <hint> rather than waiting for auto-compact
// (which fires when the model is least sharp). PostToolUse additionalContext enters Claude's
// context as a system reminder (docs: code.claude.com/docs/en/context-window — prettier hook).

import { join } from "node:path";
import { tmpdir } from "node:os";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { readStdinJson, emitContext } from "./lib/io.mjs";
import {
  readContextUsage,
  shouldNudgeCompact,
  decideNudge,
  buildCompactHint,
} from "./lib/context-usage.mjs";
import { findInProgressTask } from "./lib/plan.mjs";

const input = await readStdinJson();

const usage = readContextUsage(String(input.transcript_path ?? ""));
if (!usage) process.exit(0); // can't read context → stay silent (no pct to record)

const pct = Math.round((usage.tokens / usage.windowSize) * 100);

// Anti-spam dedup. State lives in the OS temp dir keyed by session id — NOT in .claude/
// (which is git-tracked; a state file there would pollute every managed project's `git status`).
// We ALWAYS persist the latest mark BEFORE the threshold gate, so the mark can fall through the
// sub-threshold band where a /compact lands and the next climb still nudges (see decideNudge).
const stateFile = stateFilePath(String(input.session_id ?? ""));
const aboveThreshold = shouldNudgeCompact(usage.tokens, usage.windowSize);
const { emit, nextMark } = decideNudge(pct, readPrevPct(stateFile), aboveThreshold);
writePrevPct(stateFile, nextMark);
if (!emit) process.exit(0);

const cwd = String(input.cwd ?? process.cwd());
const task = findInProgressTask(join(cwd, ".claude", "plan", "PLAN.md"));
const hint = buildCompactHint(task);

emitContext(
  "PostToolUse",
  `<ccf>Context ~${pct}% (${usage.tokens} tokens) — entering the degrade zone where the model gets less sharp. ` +
    `Proactively tell the user to run a focused compact NOW rather than waiting for auto-compact. Suggested:\n  ${hint}</ccf>`,
);

// ----------------------------------------------------------------------------

/**
 * Temp-dir path for the dedup state of a session. Hash the id so it is filename-safe.
 * @param {string} sessionId
 * @returns {string}
 */
function stateFilePath(sessionId) {
  const key = createHash("sha1").update(sessionId || "default").digest("hex").slice(0, 16);
  return join(tmpdir(), `ccf-compact-nudge-${key}.json`);
}

/**
 * Read the last-nudged percentage from the state file. Any error → NaN (treated as "no mark").
 * @param {string} file
 * @returns {number}
 */
function readPrevPct(file) {
  if (!existsSync(file)) return NaN;
  try {
    return Number(JSON.parse(readFileSync(file, "utf8")).pct);
  } catch {
    return NaN;
  }
}

/**
 * Persist the last-nudged percentage. Best-effort — failure is swallowed (advisory only).
 * @param {string} file
 * @param {number} pct
 */
function writePrevPct(file, pct) {
  try {
    writeFileSync(file, JSON.stringify({ pct }), "utf8");
  } catch {
    // ignore — dedup is a nicety, not a correctness requirement
  }
}
