#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { findNonDoneTasks } from "../hooks/lib/plan.mjs";
import { askJev, JEV_DEFAULT_URL } from "../hooks/lib/jev-client.mjs";
import { extractAcceptanceCriteria, withinSizeCap, DEFAULT_CAP_BYTES } from "../hooks/lib/completion-evidence.mjs";
import { extractFiles, extractDependsOn, buildSliceRequests, mergeSliceAnswers } from "../hooks/lib/slice-check.mjs";
import { iterationSlug, worktreeName } from "../hooks/lib/worktree-wave.mjs";

function done(obj = {}) {
  console.log(JSON.stringify(obj, null, 2));
  process.exit(0);
}

function readFlagValue(argv = [""], flag = "") {
  const i = argv.indexOf(flag);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : undefined;
}

async function consultJev(state = {}, batches = [{}], wanted = false) {
  if (!wanted) return { jev: "not-asked", results: [] };
  const key = String(process.env.TYPESAFE_API_KEY ?? "").trim();
  if (!key) return { jev: "no-key", results: [] };
  if (!withinSizeCap(JSON.stringify(state), DEFAULT_CAP_BYTES)) return { jev: "too-large", results: [] };
  if (batches.length === 0) return { jev: "asked", results: [] };
  const baseUrl = process.env.CCF_JEV_URL || JEV_DEFAULT_URL;
  const results = await Promise.all(batches.map((questions) => askJev({ apiKey: key, baseUrl, state, questions })));
  return { jev: "asked", results };
}

try {
  const argv = process.argv.slice(2);
  const projectDir = readFlagValue(argv, "--dir") ?? process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
  const planDir = join(projectDir, ".claude", "plan");
  const planFile = join(planDir, "PLAN.md");
  if (!existsSync(planFile)) done({ ok: false, reason: "no-plan" });

  const only = readFlagValue(argv, "--tasks")?.split(",").map((s) => s.trim()).filter(Boolean);
  const files = readdirSync(planDir);
  const tasks = findNonDoneTasks(planFile)
    .filter((row) => !only || only.includes(row.id))
    .map((row) => {
      const name = files.find((f) => f.startsWith(`task-${row.id}-`) && f.endsWith(".md"));
      const text = name ? readFileSync(join(planDir, name), "utf8") : "";
      return { id: row.id, title: row.title, taskFile: name ?? null, files: extractFiles(text), criteria: extractAcceptanceCriteria(text), dependsOn: extractDependsOn(text) };
    });
  if (tasks.length === 0) done({ ok: false, reason: "no-open-tasks" });

  const { state, batches } = buildSliceRequests(tasks);
  const { jev, results } = await consultJev(state, batches, argv.includes("--jev"));
  const merged = mergeSliceAnswers(tasks, results, { askedJev: jev === "asked" });
  const iteration = iterationSlug(readFileSync(planFile, "utf8"));
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const waves = merged.waves.map((ids) => ids.map((id) => {
    const worktree = worktreeName(iteration, id);
    return { id, title: byId.get(id)?.title ?? "", taskFile: byId.get(id)?.taskFile ?? null, worktree, branch: worktree ? `worktree-${worktree}` : null };
  }));
  done({ ok: true, iteration, jev, tasks: tasks.length, waves, edges: merged.edges, unanswered: merged.unanswered, skipped: merged.skipped, fragments: merged.fragments });
} catch {
  done({ ok: false, reason: "error" });
}
