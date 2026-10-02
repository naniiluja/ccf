#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import {
  summarizeAggregate,
  renderChangelogSection,
  hasVersionEntry,
  missingCases,
  insertSection,
} from "../hooks/lib/eval-changelog.mjs";

const AGGREGATE_FILE = "aggregate-result.json";

function finish(obj = {}, code = 0) {
  console.log(JSON.stringify(obj, null, 2));
  process.exit(code);
}

function readFlagValue(argv = [""], flag = "") {
  const i = argv.indexOf(flag);
  return i >= 0 && i + 1 < argv.length && !argv[i + 1].startsWith("--") ? argv[i + 1] : undefined;
}

function describe(err = Object()) {
  return err instanceof Error ? err.message : String(err);
}

function listDirs(dir = "") {
  try {
    return readdirSync(dir).filter((name) => statSync(join(dir, name)).isDirectory());
  } catch {
    return [];
  }
}

function currentCaseNames(evalsDir = "") {
  return listDirs(evalsDir)
    .filter((name) => existsSync(join(evalsDir, name, "case.yaml")))
    .sort();
}

function newestResultsDir(resultsRoot = "") {
  const runs = listDirs(resultsRoot)
    .filter((name) => existsSync(join(resultsRoot, name, AGGREGATE_FILE)))
    .sort();
  return runs.length === 0 ? undefined : join(resultsRoot, runs[runs.length - 1]);
}

function aggregatePath(results = "") {
  return results.endsWith(".json") ? results : join(results, AGGREGATE_FILE);
}

function readVersion(projectDir = "") {
  try {
    const version = JSON.parse(readFileSync(join(projectDir, "package.json"), "utf8")).version;
    return typeof version === "string" && version.trim() !== "" ? version.trim() : undefined;
  } catch {
    return undefined;
  }
}

function readText(file = "") {
  try {
    return readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

function escapeRegExp(text = "") {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sectionBody(argv = [""], evalsDir = "") {
  const notRun = readFlagValue(argv, "--not-run");
  if (argv.includes("--not-run")) {
    if (!notRun || notRun.trim() === "") return { error: "not-run-needs-reason" };
    return { body: { notRun }, results: null, missing: [] };
  }
  const explicit = readFlagValue(argv, "--results");
  const results = explicit ? resolve(explicit) : newestResultsDir(join(evalsDir, "results"));
  if (!results) return { body: { notRun: `no evals/results run with ${AGGREGATE_FILE} found` }, results: null, missing: [] };
  const file = aggregatePath(results);
  const rows = summarizeAggregate(JSON.parse(readFileSync(file, "utf8")));
  const current = currentCaseNames(evalsDir);
  const missing = missingCases(rows, current);
  if (missing.length > 0) {
    const covered = current.length - missing.length;
    return {
      body: { notRun: `eval run ${basename(dirname(file))} covers ${covered} of ${current.length} current cases, missing ${missing.join(", ")}` },
      results: file,
      missing,
    };
  }
  return { body: rows, results: file, missing };
}

function readSectionBody(argv = [""], evalsDir = "") {
  try {
    return { error: undefined, detail: undefined, ...sectionBody(argv, evalsDir) };
  } catch (err) {
    return { error: "bad-results", detail: describe(err), body: undefined, results: null, missing: [] };
  }
}

const argv = process.argv.slice(2);
const apply = argv.includes("--apply");
const projectDir = resolve(readFlagValue(argv, "--dir") ?? process.env.CLAUDE_PROJECT_DIR ?? process.cwd());
const evalsDir = join(projectDir, "plugins", "ccf", "evals");
const changelogPath = join(projectDir, "CHANGELOG.md");

const version = readVersion(projectDir);
if (!version) finish({ ok: false, reason: "no-package-version", projectDir });

const plan = readSectionBody(argv, evalsDir);
if (plan.error) finish({ ok: false, reason: plan.error, detail: plan.detail });

const section = renderChangelogSection(String(version), plan.body);
const existing = readText(changelogPath);
const headingPresent = new RegExp(`^##\\s+v?${escapeRegExp(String(version))}(\\s|$)`, "m").test(existing);
const report = {
  ok: true,
  version,
  results: plan.results,
  missingCases: plan.missing,
  changelog: changelogPath,
  alreadyPresent: hasVersionEntry(existing, String(version)),
  headingPresent,
  section,
  applied: false,
};

if (!apply) finish({ ...report, note: "preview only; re-run with --apply to write CHANGELOG.md (never commits)" });
if (headingPresent) finish({ ...report, note: `CHANGELOG.md already has a ## ${version} heading; nothing written` });

try {
  writeFileSync(changelogPath, insertSection(existing, section));
} catch (err) {
  finish({ ...report, ok: false, reason: "write-failed", detail: describe(err) }, 1);
}
finish({ ...report, applied: true, note: "CHANGELOG.md written; nothing was committed" });
