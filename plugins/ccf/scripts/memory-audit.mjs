#!/usr/bin/env node
// CCF memory-audit — a CLI SCRIPT (not a hook), run by /ccf:updatespec step 5b or by a person.
//
// Role: measure one project-memory directory and say whether the consolidation gate is open (more than
// 20 `feedback` files, or MEMORY.md at 150+ lines or 20KB+). Read-only: it never edits, moves or deletes a
// memory, because memory lives outside git and a wrong change there is unrecoverable; the deletion or merge
// is proposed by the model and confirmed once by the user in step 5b.
//
// Opt-in Jev column: with `--jev` AND `TYPESAFE_API_KEY` in the environment (never argv, never printed), and
// only when the gate is open, it asks Jev (TypeSafe System One) once for a keep/merge/drop score per memory.
// Every memory file's full text (including `user`-type memories) and MEMORY.md are sent to api.typesafe.ai.
// The label is advisory; any failure leaves the audit unchanged and only sets the top-level `jev` status.
//
// Usage:  node scripts/memory-audit.mjs --memory-dir <path> [--max-feedback 20] [--index-lines 150]
//         [--index-kb 20] [--jev]
// Prints JSON and always exits 0. Test seams: CCF_JEV_URL (base URL), CCF_JEV_TIMEOUT_MS (abort deadline).

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { askJev, JEV_DEFAULT_URL } from "../hooks/lib/jev-client.mjs";
import { auditMemory, shouldConsolidate, buildJevMemoryRequest, labelFromAnswers, DEFAULT_THRESHOLDS } from "../hooks/lib/memory-audit.mjs";

/** No hook deadline applies to a script, so allow a slow answer (same as jev-verify-findings.mjs). */
const SCRIPT_TIMEOUT_MS = 30_000;
const INDEX_FILE = "MEMORY.md";

/**
 * Print the result and exit 0.
 * @param {Record<string, any>} obj
 * @returns {never}
 */
function done(obj) {
  console.log(JSON.stringify(obj, null, 2));
  process.exit(0);
}

/**
 * @param {string[]} argv
 * @param {string} flag
 * @returns {string | undefined}
 */
function readFlagValue(argv, flag) {
  const i = argv.indexOf(flag);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : undefined;
}

/**
 * @param {string[]} argv
 * @param {string} flag
 * @param {number} fallback
 * @returns {number}
 */
function readNumber(argv, flag, fallback) {
  const n = Number(readFlagValue(argv, flag));
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/**
 * Top-level `*.md` memory files (MEMORY.md is the index, not a memory), sorted by name.
 * @param {string} dir
 * @returns {{ name: string, text: string }[]}
 */
function readMemoryFiles(dir) {
  /** @type {{ name: string, text: string }[]} */
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    if (name === INDEX_FILE || !name.toLowerCase().endsWith(".md")) continue;
    try {
      const path = join(dir, name);
      if (statSync(path).isFile()) out.push({ name, text: readFileSync(path, "utf8") });
    } catch {
      // An unreadable entry is skipped: the audit is advisory and must not fail on one file.
    }
  }
  return out;
}

try {
  const argv = process.argv.slice(2);
  const dir = readFlagValue(argv, "--memory-dir");
  if (!dir) done({ gate: false, reason: "no-memory-dir-arg" });
  let isDir = false;
  try { isDir = statSync(dir).isDirectory(); } catch { isDir = false; }
  if (!isDir) done({ gate: false, reason: "no-memory-dir" });

  let indexText = "";
  try { indexText = readFileSync(join(dir, INDEX_FILE), "utf8"); } catch { indexText = ""; }
  const files = readMemoryFiles(dir);
  const audit = auditMemory({ indexText, files });
  const { gate, reasons } = shouldConsolidate(
    { feedbackCount: audit.counts.feedback, indexLines: audit.index.lines, indexBytes: audit.index.bytes },
    {
      maxFeedback: readNumber(argv, "--max-feedback", DEFAULT_THRESHOLDS.maxFeedback),
      indexLines: readNumber(argv, "--index-lines", DEFAULT_THRESHOLDS.indexLines),
      indexKb: readNumber(argv, "--index-kb", DEFAULT_THRESHOLDS.indexKb),
    },
  );
  const result = { gate, reasons, counts: audit.counts, index: audit.index, danglingIndex: audit.danglingIndex, unindexed: audit.unindexed, files: audit.files };

  const key = String(process.env.TYPESAFE_API_KEY ?? "").trim();
  if (!argv.includes("--jev")) done({ ...result, jev: "off" });
  if (!key) done({ ...result, jev: "no-key" });
  if (!gate) done({ ...result, jev: "gate-closed" });

  const req = buildJevMemoryRequest(files, indexText);
  if (!req.ok) done({ ...result, jev: req.reason });
  const timeoutMs = Number(process.env.CCF_JEV_TIMEOUT_MS) > 0 ? Number(process.env.CCF_JEV_TIMEOUT_MS) : SCRIPT_TIMEOUT_MS;
  const res = await askJev({ apiKey: key, baseUrl: process.env.CCF_JEV_URL || JEV_DEFAULT_URL, state: req.state, questions: req.questions, timeoutMs });
  if (!res.ok) done({ ...result, jev: res.reason });
  const labels = labelFromAnswers(res.answers, files);
  done({ ...result, files: result.files.map((f) => (labels[f.file] ? { ...f, jev: labels[f.file] } : f)), jev: "ok" });
} catch {
  done({ gate: false, reason: "error" });
}
