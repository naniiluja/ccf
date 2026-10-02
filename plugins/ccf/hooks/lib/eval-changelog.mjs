const TITLE = "# Changelog";
const TABLE_HEADER = "| case | pass | mean score | cost |";

function shapeError(detail = "") {
  return new Error(`aggregate-result.json has an unexpected shape: ${detail}`);
}

function isPlainObject(value = {}) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value = NaN) {
  return typeof value === "number" && Number.isFinite(value);
}

function summarizeRun(input = {}, caseName = "") {
  if (!isPlainObject(input)) throw shapeError(`case "${caseName}" has a run that is not an object`);
  const { score, passed, costUsd, judgeCostUsd = 0 } = Object(input);
  if (!isFiniteNumber(score) || score < 0 || score > 1) {
    throw shapeError(`case "${caseName}" has a run score outside 0..1 (${JSON.stringify(score)})`);
  }
  if (typeof passed !== "boolean") throw shapeError(`case "${caseName}" has a run without a boolean "passed"`);
  if (!isFiniteNumber(costUsd)) throw shapeError(`case "${caseName}" has a run without a numeric "costUsd"`);
  if (!isFiniteNumber(judgeCostUsd)) throw shapeError(`case "${caseName}" has a non-numeric "judgeCostUsd"`);
  return { score, passed, cost: costUsd + judgeCostUsd };
}

function summarizeCase(input = {}) {
  if (!isPlainObject(input)) throw shapeError("a case is not an object");
  const { name, runsPerCase, arms } = Object(input);
  if (typeof name !== "string" || name === "") throw shapeError("a case has no name");
  if (!Number.isInteger(runsPerCase) || runsPerCase < 1) throw shapeError(`case "${name}" has no positive integer "runsPerCase"`);
  if (!isPlainObject(arms) || !Array.isArray(arms.with)) throw shapeError(`case "${name}" has no "arms.with" array`);
  const runs = arms.with.map((run = {}) => summarizeRun(run, name));
  const scoreSum = runs.reduce((sum = 0, r = { score: 0 }) => sum + r.score, 0);
  const cost = runs.reduce((sum = 0, r = { cost: 0 }) => sum + r.cost, 0);
  return {
    caseName: name,
    passed: runs.filter((r = { passed: false }) => r.passed).length,
    runs: runs.length,
    expectedRuns: runsPerCase,
    meanScore: runs.length === 0 ? null : scoreSum / runs.length,
    costUsd: Math.round(cost * 1e6) / 1e6,
  };
}

export function summarizeAggregate(input = {}) {
  if (!isPlainObject(input)) throw shapeError("the top level is not an object");
  const { cases } = Object(input);
  if (!Array.isArray(cases)) throw shapeError('no "cases" array');
  return cases.map((evalCase = {}) => summarizeCase(evalCase));
}

function renderRow(input = {}) {
  const row = Object(input);
  const ran = row.runs < row.expectedRuns ? ` (${row.runs} ran)` : "";
  const score = row.meanScore === null ? "n/a" : row.meanScore.toFixed(2);
  return `| ${row.caseName} | ${row.passed}/${row.expectedRuns}${ran} | ${score} | $${row.costUsd.toFixed(2)} |`;
}

export function renderChangelogSection(version = "", body = {}) {
  if (typeof version !== "string" || version.trim() === "") throw new Error("renderChangelogSection needs a version");
  if (Array.isArray(body)) {
    if (body.length === 0) throw new Error("renderChangelogSection needs at least one score row");
    return [`## ${version}`, "", TABLE_HEADER, "| --- | --- | --- | --- |", ...body.map((row = {}) => renderRow(row)), ""].join("\n");
  }
  const reason = isPlainObject(body) ? String(Object(body).notRun ?? "").trim() : "";
  if (reason === "") throw new Error("renderChangelogSection needs score rows or { notRun: <reason> }");
  return `## ${version}\n\neval: not run: ${reason}\n`;
}

function escapeRegExp(text = "") {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function hasVersionEntry(changelogText = "", version = "") {
  if (String(version).trim() === "") return false;
  const lines = String(changelogText).split(/\r?\n/);
  const heading = new RegExp(`^##\\s+v?${escapeRegExp(String(version))}(\\s|$)`);
  const start = lines.findIndex((line) => heading.test(line));
  if (start < 0) return false;
  const rest = lines.slice(start + 1);
  const next = rest.findIndex((line) => /^##\s/.test(line));
  const body = next < 0 ? rest : rest.slice(0, next);
  if (body.some((line) => /^eval: not run: \S/.test(line))) return true;
  const header = body.findIndex((line) => line.trim() === TABLE_HEADER);
  return header >= 0 && body.slice(header + 2).some((line) => /^\|.*\|$/.test(line.trim()));
}

export function missingCases(rows = [{ caseName: "" }], currentCaseNames = [""]) {
  const present = new Set(rows.map((row) => row.caseName));
  return currentCaseNames.filter((name) => !present.has(name));
}

export function insertSection(changelogText = "", section = "") {
  const text = String(changelogText);
  const rest = text.startsWith(TITLE) ? text.slice(TITLE.length).replace(/^\s*/, "") : text.trim() === "" ? "" : text;
  return `${TITLE}\n\n${section}${rest === "" ? "" : `\n${rest}`}`;
}
