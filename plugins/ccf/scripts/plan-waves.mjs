#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { findNonDoneTasks } from "../hooks/lib/plan.mjs";
import { askJev, JEV_DEFAULT_URL } from "../hooks/lib/jev-client.mjs";
import { extractAcceptanceCriteria, withinSizeCap, DEFAULT_CAP_BYTES } from "../hooks/lib/completion-evidence.mjs";
import { extractFiles, extractDependsOn, buildSliceRequests, mergeSliceAnswers } from "../hooks/lib/slice-check.mjs";
import { iterationSlug, worktreeName } from "../hooks/lib/worktree-wave.mjs";
import { extractGoal, buildInlineRequest, decideTaskModes } from "../hooks/lib/inline-gate.mjs";
import { readRuntimeEvidence } from "../hooks/lib/runtime-evidence.mjs";

const INLINE_TIMEOUT_MS = 30_000;

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

function countLines(path = "") {
  try {
    const text = readFileSync(path, "utf8");
    return (text.match(/\n/g) ?? []).length + (text && !text.endsWith("\n") ? 1 : 0);
  } catch {
    return 0;
  }
}

async function consultInline(tasks = [{ id: "", title: "", goal: "", files: [""], fileLines: [0], criteria: [""], touchesUi: false }], wanted = false) {
  if (!wanted) return { status: "not-asked", answers: {} };
  const key = String(process.env.TYPESAFE_API_KEY ?? "").trim();
  if (!key) return { status: "no-key", answers: {} };
  const req = buildInlineRequest(tasks);
  if (!req.ok) return { status: req.reason, answers: {} };
  const timeoutMs = Number(process.env.CCF_JEV_TIMEOUT_MS) > 0 ? Number(process.env.CCF_JEV_TIMEOUT_MS) : INLINE_TIMEOUT_MS;
  const res = await askJev({ apiKey: key, baseUrl: process.env.CCF_JEV_URL || JEV_DEFAULT_URL, state: req.state, questions: req.questions, timeoutMs });
  return res.ok ? { status: "ok", answers: res.answers } : { status: res.reason, answers: {} };
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
      const declared = extractFiles(text);
      return { id: row.id, title: row.title, taskFile: name ?? null, files: declared, criteria: extractAcceptanceCriteria(text), dependsOn: extractDependsOn(text), goal: extractGoal(text), touchesUi: readRuntimeEvidence(text).touchesUi, fileLines: declared.map((f) => countLines(join(projectDir, f))) };
    });
  if (tasks.length === 0) done({ ok: false, reason: "no-open-tasks" });

  const { state, batches } = buildSliceRequests(tasks);
  const { jev, results } = await consultJev(state, batches, argv.includes("--jev"));
  const merged = mergeSliceAnswers(tasks, results, { askedJev: jev === "asked" });
  const inline = await consultInline(tasks, argv.includes("--inline"));
  const modes = decideTaskModes(tasks, inline);
  const iteration = iterationSlug(readFileSync(planFile, "utf8"));
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const waves = merged.waves.map((ids) => ids.map((id) => {
    const worktree = worktreeName(iteration, id);
    const mode = modes.get(id) ?? { mode: "worktree", reason: "not-asked", score: null };
    return { id, title: byId.get(id)?.title ?? "", taskFile: byId.get(id)?.taskFile ?? null, worktree, branch: worktree ? `worktree-${worktree}` : null, mode: mode.mode, modeReason: mode.reason, inlineScore: mode.score };
  }));
  done({ ok: true, iteration, jev, inline: inline.status, tasks: tasks.length, waves, edges: merged.edges, unanswered: merged.unanswered, skipped: merged.skipped, fragments: merged.fragments });
} catch {
  done({ ok: false, reason: "error" });
}
