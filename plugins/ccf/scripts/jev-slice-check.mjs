#!/usr/bin/env node
// CCF jev-slice-check — a human-run CLI SCRIPT (not a hook, not a command).
//
// Role: after the plan skill has written its task table, ask Jev (TypeSafe System One) which OPEN task
// pairs depend on each other, which pairs change the same contract, and which tasks are too small to
// stand alone; print the result as JSON for the user and the model to weigh. It is advisory: it never
// edits PLAN.md or a task file, and it always exits 0 (a missing key or network is reported in the
// JSON, never allowed to block planning).
//
// WHY A SCRIPT: each call costs money and needs a key, so a person (or the plan skill, on their
// behalf) chooses to run it; nothing invokes it automatically. Same split as archive-plan.mjs.
// What is sent: task ids, titles, `Files to touch` and acceptance criteria. No source code.
//
// Usage:  node scripts/jev-slice-check.mjs [--dir <path>]      (default dir: $CLAUDE_PROJECT_DIR or cwd)
// Needs:  TYPESAFE_API_KEY in the environment. CCF_JEV_URL overrides the base URL (test seam).

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { findNonDoneTasks } from "../hooks/lib/plan.mjs";
import { askJev, JEV_DEFAULT_URL } from "../hooks/lib/jev-client.mjs";
import { extractAcceptanceCriteria, withinSizeCap, DEFAULT_CAP_BYTES } from "../hooks/lib/completion-evidence.mjs";
import { extractFiles, buildSliceRequests, mergeSliceAnswers } from "../hooks/lib/slice-check.mjs";

/** @param {Record<string, any>} obj */
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

try {
  const argv = process.argv.slice(2);
  const projectDir = readFlagValue(argv, "--dir") ?? process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
  const key = String(process.env.TYPESAFE_API_KEY ?? "").trim();
  if (!key) done({ ok: false, reason: "no-key", note: "Set TYPESAFE_API_KEY to enable the Jev slice check; planning continues without it." });

  const planDir = join(projectDir, ".claude", "plan");
  const planFile = join(planDir, "PLAN.md");
  if (!existsSync(planFile)) done({ ok: false, reason: "no-plan" });

  const files = readdirSync(planDir);
  const tasks = findNonDoneTasks(planFile).map((row) => {
    const name = files.find((f) => f.startsWith(`task-${row.id}-`) && f.endsWith(".md"));
    const text = name ? readFileSync(join(planDir, name), "utf8") : "";
    return { id: row.id, title: row.title, files: extractFiles(text), criteria: extractAcceptanceCriteria(text) };
  });
  if (tasks.length < 2) done({ ok: false, reason: "not-enough-tasks", tasks: tasks.length });

  const { state, batches } = buildSliceRequests(tasks);
  if (!withinSizeCap(JSON.stringify(state), DEFAULT_CAP_BYTES)) done({ ok: false, reason: "too-large" });

  const baseUrl = process.env.CCF_JEV_URL || JEV_DEFAULT_URL;
  const results = await Promise.all(batches.map((questions) => askJev({ apiKey: key, baseUrl, state, questions })));
  const merged = mergeSliceAnswers(tasks, results);
  done({ ok: true, tasks: tasks.length, batches: batches.length, ...merged });
} catch {
  done({ ok: false, reason: "error" });
}
