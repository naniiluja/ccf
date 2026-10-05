#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { collectTaskRows, findActiveTask, findOpenPendingItems, isClosedStatus, isRealTaskRow } from "./plan.mjs";
import { specsOlderThanCode } from "./freshness.mjs";
import { columnOf } from "./ui-model.mjs";

export function readSnapshot(dir = "") {
  const planDir = join(dir, ".claude", "plan");
  const planFile = join(planDir, "PLAN.md");
  if (!existsSync(planFile)) return { ok: false, reason: "no-plan" };
  const tasks = collectTaskRows(readFileSync(planFile, "utf8").split(/\r?\n/))
    .filter(isRealTaskRow)
    .map((row) => ({ ...row, column: columnOf(row.status, isClosedStatus(row.status)) }));
  const activeId = findActiveTask(planFile)?.id;
  const active = tasks.find((task) => task.id === activeId) ?? null;
  const openRisks = findOpenPendingItems(join(planDir, "PENDING.md")).filter((item) => /^risk$/i.test(item.kind)).length;
  const specStale = specsOlderThanCode(dir, join(dir, ".claude", "rules"));
  return { ok: true, active, tasks, openRisks, specStale };
}

function readDir(argv = [""]) {
  const i = argv.indexOf("--dir");
  if (i >= 0 && i + 1 < argv.length) return argv[i + 1];
  return process.env.CLAUDE_PROJECT_DIR || process.cwd();
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    console.log(JSON.stringify(readSnapshot(resolve(readDir(process.argv.slice(2))))));
  } catch {
    console.log(JSON.stringify({ ok: false, reason: "error" }));
  }
  process.exit(0);
}
