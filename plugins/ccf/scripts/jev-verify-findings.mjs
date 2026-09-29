#!/usr/bin/env node
// CCF jev-verify-findings — a human-run CLI SCRIPT (not a hook, not a command).
//
// Role: read a /ccf:check report on stdin, ask Jev (TypeSafe System One) one question per `FAIL:` finding,
// "does the diff contain exactly this defect?", and print every finding with Jev's score as JSON. It only
// ANNOTATES: a finding Jev does not confirm keeps its `FAIL:` marker and gains a note for a human, because
// letting an outside model downgrade findings would trade false positives for missed defects.
//
// WHY A SCRIPT: each call costs money, needs a key and sends the diff off the machine, so a person (or
// /ccf:check step 6b, on their behalf and only when the key is set) chooses to run it. It edits nothing
// and always exits 0; `no-key`, `no-findings`, `no-diff`, `empty-diff`, `too-large`, an API failure
// reason or `error` are reported in the JSON.
// What is sent: `git diff <base>...HEAD` minus sensitive files (same filter and 80KB cap as the
// completion-evidence hook), plus each finding's text, location and quoted rule.
//
// Usage:  node scripts/jev-verify-findings.mjs [--dir <path>] [--base <ref>] < report.md
//         (default dir: $CLAUDE_PROJECT_DIR or cwd; default base: main, else master)
// Needs:  TYPESAFE_API_KEY in the environment. CCF_JEV_URL overrides the base URL (test seam).

import { spawnSync } from "node:child_process";
import { askJev, JEV_DEFAULT_URL } from "../hooks/lib/jev-client.mjs";
import { parseFailFindings, buildFindingQuestions, annotateFindings } from "../hooks/lib/finding-verify.mjs";

/** No hook deadline applies to a script, so allow a slow answer instead of the hook's 6.5s abort. */
const SCRIPT_TIMEOUT_MS = 30_000;

/**
 * Print the result and exit 0; `never` lets the type checker narrow the early-exit branches below.
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

/** @returns {Promise<string>} all of stdin, or "" when it is a terminal */
async function readStdin() {
  if (process.stdin.isTTY) return "";
  let text = "";
  for await (const chunk of process.stdin) text += chunk;
  return text;
}

/**
 * @param {string} dir
 * @param {string[]} args
 * @returns {string | null} stdout, or null when git fails
 */
function git(dir, args) {
  const r = spawnSync("git", args, { cwd: dir, encoding: "utf8", shell: false, maxBuffer: 64 * 1024 * 1024 });
  return r.status === 0 && typeof r.stdout === "string" ? r.stdout : null;
}

/**
 * The diff /ccf:check step 4 reviews: `<base>...HEAD`, with base defaulting to main, then master.
 * @param {string} dir
 * @param {string | undefined} base
 * @returns {string | null}
 */
function reviewedDiff(dir, base) {
  const candidates = base ? [base] : ["main", "master"];
  const ref = candidates.find((c) => git(dir, ["rev-parse", "--verify", "--quiet", `${c}^{commit}`]) !== null);
  return ref ? git(dir, ["diff", `${ref}...HEAD`]) : null;
}

try {
  const argv = process.argv.slice(2);
  const projectDir = readFlagValue(argv, "--dir") ?? process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
  const findings = parseFailFindings(await readStdin());
  const key = String(process.env.TYPESAFE_API_KEY ?? "").trim();
  if (!key) done({ ok: false, reason: "no-key", note: "Set TYPESAFE_API_KEY to have Jev annotate FAIL: findings; the review stands without it." });
  if (findings.length === 0) done({ ok: false, reason: "no-findings" });

  const diff = reviewedDiff(projectDir, readFlagValue(argv, "--base"));
  if (diff === null) done({ ok: false, reason: "no-diff" });

  const req = buildFindingQuestions(findings, diff);
  if (!req.ok) done({ ok: false, reason: req.reason, findings: annotateFindings(findings, {}) });

  const baseUrl = process.env.CCF_JEV_URL || JEV_DEFAULT_URL;
  const res = await askJev({ apiKey: key, baseUrl, state: req.state, questions: req.questions, timeoutMs: SCRIPT_TIMEOUT_MS });
  if (!res.ok) done({ ok: false, reason: res.reason, findings: annotateFindings(findings, {}), omitted: req.omitted });
  done({ ok: true, findings: annotateFindings(findings, res.answers), omitted: req.omitted });
} catch {
  done({ ok: false, reason: "error" });
}
