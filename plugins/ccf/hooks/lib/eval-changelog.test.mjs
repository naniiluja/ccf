import { test } from "node:test";
import assert from "node:assert/strict";
import {
  summarizeAggregate,
  renderChangelogSection,
  hasVersionEntry,
  missingCases,
  insertSection,
} from "./eval-changelog.mjs";

const run = (score, passed, costUsd = 0.3, judgeCostUsd = 0) => ({ score, passed, costUsd, judgeCostUsd });
const evalCase = (name, runs, runsPerCase = 3) => ({ name, runsPerCase, arms: { with: runs } });
const aggregate = (cases) => ({ schemaVersion: 1, cases });

const CASE_NAMES = [
  "01-missing-criterion",
  "02-boundary-error",
  "03-scope-creep",
  "04-rule-violation",
  "05-swallowed-error",
  "06-clean-diff",
  "07-scope-only",
  "08-permitted-pattern",
];

test("summarizeAggregate: 8 cases with 3 runs each give one row per case in input order", () => {
  const rows = summarizeAggregate(aggregate(CASE_NAMES.map((n) => evalCase(n, [run(1, true), run(1, true), run(0.5, false)]))));
  assert.equal(rows.length, 8);
  assert.deepEqual(rows.map((r) => r.caseName), CASE_NAMES);
  assert.deepEqual(rows[0], { caseName: "01-missing-criterion", passed: 2, runs: 3, expectedRuns: 3, meanScore: 2.5 / 3, costUsd: 0.9 });
});

test("summarizeAggregate: a case with missing runs keeps the expected count apart from the runs that happened", () => {
  const [row] = summarizeAggregate(aggregate([evalCase("03-scope-creep", [run(0.5, false)])]));
  assert.equal(row.runs, 1);
  assert.equal(row.expectedRuns, 3);
  assert.equal(row.passed, 0);
});

test("summarizeAggregate: empty arms.with gives 0 runs and no mean score", () => {
  const [row] = summarizeAggregate(aggregate([evalCase("06-clean-diff", [])]));
  assert.deepEqual(row, { caseName: "06-clean-diff", passed: 0, runs: 0, expectedRuns: 3, meanScore: null, costUsd: 0 });
});

test("summarizeAggregate: score bounds 0 and 1 are accepted", () => {
  const [low, high] = summarizeAggregate(aggregate([evalCase("a", [run(0, false)]), evalCase("b", [run(1, true)])]));
  assert.equal(low.meanScore, 0);
  assert.equal(high.meanScore, 1);
});

test("summarizeAggregate: judge cost is added to the run cost", () => {
  const [row] = summarizeAggregate(aggregate([evalCase("a", [run(1, true, 0.25, 0.5)])]));
  assert.equal(row.costUsd, 0.75);
});

for (const [label, input] of [
  ["null", null],
  ["an array", []],
  ["no cases array", { schemaVersion: 1 }],
  ["cases not an array", { cases: {} }],
  ["a case without a name", aggregate([{ runsPerCase: 3, arms: { with: [] } }])],
  ["a case without arms.with", aggregate([{ name: "a", runsPerCase: 3, arms: {} }])],
  ["runsPerCase 0", aggregate([evalCase("a", [], 0)])],
  ["runsPerCase not an integer", aggregate([evalCase("a", [], 1.5)])],
  ["a run score below 0", aggregate([evalCase("a", [run(-0.01, false)])])],
  ["a run score above 1", aggregate([evalCase("a", [run(1.01, true)])])],
  ["a run score not a number", aggregate([evalCase("a", [{ score: "1", passed: true, costUsd: 0 }])])],
  ["a run without passed", aggregate([evalCase("a", [{ score: 1, costUsd: 0 }])])],
  ["a run without costUsd", aggregate([evalCase("a", [{ score: 1, passed: true }])])],
]) {
  test(`summarizeAggregate: wrong shape (${label}) throws a clear error`, () => {
    assert.throws(() => summarizeAggregate(input), /aggregate-result\.json/);
  });
}

test("renderChangelogSection: rows render a heading and a score table", () => {
  const rows = summarizeAggregate(aggregate([evalCase("01-missing-criterion", [run(1, true), run(1, true), run(0.5, false)])]));
  const text = renderChangelogSection("1.2.3", rows);
  assert.equal(
    text,
    [
      "## 1.2.3",
      "",
      "| case | pass | mean score | cost |",
      "| --- | --- | --- | --- |",
      "| 01-missing-criterion | 2/3 | 0.83 | $0.90 |",
      "",
    ].join("\n"),
  );
});

test("renderChangelogSection: missing runs and an empty case are visible in the row", () => {
  const rows = summarizeAggregate(aggregate([evalCase("a", [run(1, true)]), evalCase("b", [])]));
  const text = renderChangelogSection("1.0.0", rows);
  assert.match(text, /\| a \| 1\/3 \(1 ran\) \| 1\.00 \| \$0\.30 \|/);
  assert.match(text, /\| b \| 0\/3 \(0 ran\) \| n\/a \| \$0\.00 \|/);
});

test("renderChangelogSection: notRun renders the explicit line", () => {
  assert.equal(renderChangelogSection("1.0.0", { notRun: "no sandbox" }), "## 1.0.0\n\neval: not run: no sandbox\n");
});

for (const [label, version, body] of [
  ["empty version", "", { notRun: "x" }],
  ["empty rows", "1.0.0", []],
  ["blank reason", "1.0.0", { notRun: "  " }],
  ["neither rows nor notRun", "1.0.0", {}],
]) {
  test(`renderChangelogSection: ${label} throws`, () => {
    assert.throws(() => renderChangelogSection(version, body));
  });
}

const CHANGELOG_WITH_TABLE = "# Changelog\n\n## 1.0.0\n\n| case | pass | mean score | cost |\n| --- | --- | --- | --- |\n| a | 3/3 | 1.00 | $0.90 |\n";
const CHANGELOG_NOT_RUN = "# Changelog\n\n## 1.0.0\n\neval: not run: no sandbox\n";

test("hasVersionEntry: decision table", () => {
  const cases = [
    ["has a score table", CHANGELOG_WITH_TABLE, "1.0.0", true],
    ["has a not-run line", CHANGELOG_NOT_RUN, "1.0.0", true],
    ["heading with an empty body", "# Changelog\n\n## 1.0.0\n\n## 0.9.0\n\neval: not run: x\n", "1.0.0", false],
    ["different version", CHANGELOG_NOT_RUN, "1.0.1", false],
    ["version prefix only", "# Changelog\n\n## 1.0.10\n\neval: not run: x\n", "1.0.1", false],
    ["dots are literal", "# Changelog\n\n## 1x0x0\n\neval: not run: x\n", "1.0.0", false],
    ["table header without a row", "# Changelog\n\n## 1.0.0\n\n| case | pass | mean score | cost |\n| --- | --- | --- | --- |\n", "1.0.0", false],
    ["not-run line with an empty reason", "# Changelog\n\n## 1.0.0\n\neval: not run: \n", "1.0.0", false],
    ["CRLF line endings", CHANGELOG_NOT_RUN.replace(/\n/g, "\r\n"), "1.0.0", true],
    ["empty text", "", "1.0.0", false],
  ];
  for (const [label, text, version, expected] of cases) {
    assert.equal(hasVersionEntry(String(text), String(version)), expected, String(label));
  }
});

test("missingCases: names current cases absent from the rows", () => {
  const rows = summarizeAggregate(aggregate(CASE_NAMES.slice(0, 7).map((n) => evalCase(n, [run(1, true)]))));
  assert.deepEqual(missingCases(rows, CASE_NAMES), ["08-permitted-pattern"]);
  assert.deepEqual(missingCases(summarizeAggregate(aggregate(CASE_NAMES.map((n) => evalCase(n, [])))), CASE_NAMES), []);
});

test("insertSection: puts the new section right after the title, above older versions", () => {
  const out = insertSection("# Changelog\n\n## 0.9.0\n\neval: not run: x\n", "## 1.0.0\n\neval: not run: y\n");
  assert.equal(out, "# Changelog\n\n## 1.0.0\n\neval: not run: y\n\n## 0.9.0\n\neval: not run: x\n");
});

test("insertSection: an empty file gets a title first", () => {
  assert.equal(insertSection("", "## 1.0.0\n\neval: not run: y\n"), "# Changelog\n\n## 1.0.0\n\neval: not run: y\n");
});
