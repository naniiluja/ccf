#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { collectTaskRows, findNonDoneTasks } from "../hooks/lib/plan.mjs";
import { extractAcceptanceCriteria } from "../hooks/lib/completion-evidence.mjs";
import { extractFiles, extractDependsOn } from "../hooks/lib/slice-check.mjs";
import { lintPlan } from "../hooks/lib/plan-lint.mjs";

function done(obj = {}) {
  console.log(JSON.stringify(obj, null, 2));
  process.exit(0);
}

function readFlagValue(argv = [""], flag = "") {
  const i = argv.indexOf(flag);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : undefined;
}

function taskFileIds(dir = "") {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).map((f) => /^task-([A-Za-z0-9]+)-.*\.md$/.exec(f)?.[1]).filter((id) => typeof id === "string");
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
      return { id: row.id, title: row.title, taskFile: name ?? "", files: extractFiles(text), criteria: extractAcceptanceCriteria(text), dependsOn: extractDependsOn(text) };
    });
  if (tasks.length === 0) done({ ok: false, reason: "no-open-tasks" });

  const planRows = collectTaskRows(readFileSync(planFile, "utf8").split(/\r?\n/)).map((r) => String(r.id));
  const knownIds = [...planRows, ...taskFileIds(planDir), ...taskFileIds(join(planDir, "archive"))];
  done({ ok: true, tasks: tasks.length, ...lintPlan({ tasks, knownIds }) });
} catch {
  done({ ok: false, reason: "error" });
}
