#!/usr/bin/env node
// CCF completion-evidence — Stop event, OPT-IN (default no-op), ADVISORY only, never blocks.
// Mechanism: when a task is in-review and this session edited code, send the task's acceptance
// criteria + the working diff + the last test output to Jev (TypeSafe System One) and print the
// criteria it does not find met as a systemMessage. Same toggle pattern as auto-verify: it fires only
// when its hooks.json command carries `--completion-evidence` AND TYPESAFE_API_KEY is set.
// Privacy: the diff LEAVES THE MACHINE. Sensitive paths are stripped and an oversize diff is skipped
// (see lib/completion-evidence.mjs); the key comes from the environment only, never argv or output.
// Best-effort: ANY error or API failure exits 0 silently (we must never break or delay a session);
// the request aborts at ~6.5s because the harness kills a hook at 10s.
// Test seams: CCF_JEV_URL (base URL) and CCF_JEV_TIMEOUT_MS (abort deadline) let the process-level
// tests point at a local fake server.

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { readStdinJson, emitSystemMessage } from "./lib/io.mjs";
import { findInReviewTask } from "./lib/plan.mjs";
import { readTranscriptSignals, isTestCommand } from "./lib/verify-trace.mjs";
import { parseJsonl } from "./lib/review-trace.mjs";
import { askJev, JEV_DEFAULT_URL, JEV_DEFAULT_TIMEOUT_MS } from "./lib/jev-client.mjs";
import {
  extractAcceptanceCriteria,
  buildEvidenceRequest,
  unmetCriteria,
  formatAdvisory,
  lastTestOutput,
  untrackedAsDiff,
  evidenceMarkerPath,
  DEFAULT_CAP_BYTES,
} from "./lib/completion-evidence.mjs";

/**
 * Run git without a shell (Windows-clean). Empty string on any failure.
 * @param {string} cwd
 * @param {string[]} args
 * @returns {string}
 */
function git(cwd, args) {
  const res = spawnSync("git", ["-C", cwd, "-c", "core.quotePath=false", ...args], { encoding: "utf8", shell: false, maxBuffer: 20 * 1024 * 1024 });
  return res.error || res.status !== 0 ? "" : String(res.stdout ?? "");
}

/**
 * Tracked changes (`git diff HEAD`) plus untracked files rendered as diff sections.
 * @param {string} cwd
 * @returns {string}
 */
function collectDiff(cwd) {
  let diff = git(cwd, ["diff", "HEAD"]);
  for (const rel of git(cwd, ["ls-files", "--others", "--exclude-standard"]).split(/\r?\n/).filter(Boolean)) {
    try {
      // Size first: reading a huge untracked file (a build artifact nobody gitignored) could burn the
      // hook's 10s before anything is sent.
      if (statSync(join(cwd, rel)).size > DEFAULT_CAP_BYTES) {
        diff += `diff --git a/${rel} b/${rel}\n${"+".repeat(DEFAULT_CAP_BYTES + 1)}\n`; // over the cap on its own: forces the too-large skip
        continue;
      }
      diff += untrackedAsDiff(rel, readFileSync(join(cwd, rel), "utf8"));
    } catch {
      // unreadable file: leave it out
    }
  }
  return diff;
}

try {
  const key = String(process.env.TYPESAFE_API_KEY ?? "").trim();
  if (!process.argv.includes("--completion-evidence") || !key) process.exit(0);

  const input = await readStdinJson();
  const cwd = String(input.cwd ?? process.cwd());
  if (!existsSync(join(cwd, ".claude", "rules"))) process.exit(0); // CCF-managed projects only
  if (Boolean(input.stop_hook_active)) process.exit(0);

  const task = findInReviewTask(join(cwd, ".claude", "plan", "PLAN.md"));
  if (!task) process.exit(0);

  const transcriptPath = String(input.transcript_path ?? "");
  if (!readTranscriptSignals(transcriptPath).editedCode) process.exit(0);

  /** @type {Array<Record<string, any>>} */
  let records = [];
  try {
    records = parseJsonl(readFileSync(transcriptPath, "utf8"));
  } catch {
    // unreadable transcript: no test output to send
  }

  const planDir = join(cwd, ".claude", "plan");
  const taskFile = readdirSync(planDir).find((f) => f.startsWith(`task-${task.id}-`) && f.endsWith(".md"));
  if (!taskFile) process.exit(0);
  const criteria = extractAcceptanceCriteria(readFileSync(join(planDir, taskFile), "utf8"));

  const diff = collectDiff(cwd);
  const built = buildEvidenceRequest({
    task,
    criteria,
    diff,
    testOutput: lastTestOutput(records, isTestCommand),
    capBytes: DEFAULT_CAP_BYTES,
  });
  // Marker BEFORE anything is sent or said: one question (or one notice) per task+diff, and a failing
  // API is not retried on every Stop.
  const marker = evidenceMarkerPath(task.id, diff);
  if (existsSync(marker)) process.exit(0);
  if (!built.ok) {
    if (built.reason !== "too-large") process.exit(0);
    // Silence here would read as "Jev checked and found nothing", so say it did not run.
    writeFileSync(marker, "1"); // unwritable → throws → silence
    emitSystemMessage(
      `CCF completion-evidence (Jev): not checked, the diff for task ${task.id} is over the ${DEFAULT_CAP_BYTES / 1000}KB the API accepts (it rejects large requests, and truncating would make Jev judge code it cannot see). Commit finished work or narrow the change to check it.`,
    );
    process.exit(0); // emitSystemMessage already exits; this also narrows `built` for the type checker
  }
  writeFileSync(marker, "1"); // unwritable → throws → silence

  const timeoutMs = Number(process.env.CCF_JEV_TIMEOUT_MS) > 0 ? Number(process.env.CCF_JEV_TIMEOUT_MS) : JEV_DEFAULT_TIMEOUT_MS;
  const result = await askJev({
    apiKey: key,
    baseUrl: process.env.CCF_JEV_URL || JEV_DEFAULT_URL,
    state: built.state,
    questions: built.questions,
    timeoutMs,
  });
  if (!result.ok) {
    // HTTP 400 is the API refusing the request itself (its ~33K-token input limit is a measured
    // figure, and dense text can exceed it below the byte cap). Silence would read as a pass.
    if (result.reason === "http-400") {
      emitSystemMessage(`CCF completion-evidence (Jev): not checked, the API rejected the request for task ${task.id} (HTTP 400, most likely too large). Narrow the change to check it.`);
    }
    process.exit(0);
  }

  const { unmet, unjudged, scopeCreep } = unmetCriteria(result.answers, criteria);
  const text = formatAdvisory({ task, unmet, unjudged, scopeCreep, omitted: built.omitted });
  if (text) emitSystemMessage(text);
} catch {
  // best-effort: never break a session
}
process.exit(0);
