import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFailFindings, buildFindingQuestions, annotateFindings } from "./finding-verify.mjs";

const REPORT = [
  "## Review result: task 001",
  "",
  "### Violations",
  '- FAIL: rule — `src/greet.js:3` — uses console.log — rule: "Never use `console.log` in src/." (`.claude/rules/logging.md:2`) — confidence 95 — use logger.info',
  "* FAIL: scope — src/logger.js:1 — file outside the task — confidence 90 — revert it",
  "",
  "### Should-reconsider",
  "- WARN: naming — `src/greet.js:1` — confidence 60",
  "",
  "```",
  "- FAIL: <type> — `file:line` — an example inside a fence, not a finding",
  "```",
].join("\n");

const DIFF = [
  "diff --git a/src/greet.js b/src/greet.js",
  "+++ b/src/greet.js",
  "+console.log('hi')",
  "diff --git a/.env b/.env",
  "+TOKEN=abc",
].join("\n");

test("parseFailFindings: one entry per FAIL: line, with location and quoted rule; WARN: and fenced examples ignored", () => {
  const f = parseFailFindings(REPORT);
  assert.equal(f.length, 2);
  assert.equal(f[0].file, "src/greet.js");
  assert.equal(f[0].line, 3);
  assert.equal(f[0].quote, "Never use `console.log` in src/.");
  assert.match(f[0].text, /uses console\.log/);
  assert.equal(f[1].file, "src/logger.js");
  assert.equal(f[1].line, 1);
  assert.equal(f[1].quote, null);
});

test("parseFailFindings: the `rule:` label wins over an earlier quoted span in the description", () => {
  const line = '- FAIL: drift — `src/a.js:4` — prints "hi" to stdout — rule: "Never use `console.log` in src/." (`.claude/rules/logging.md:2`) — confidence 90 — use logger';
  assert.equal(parseFailFindings(line)[0].quote, "Never use `console.log` in src/.");
  assert.equal(parseFailFindings('- FAIL: x — `a.js:1` — says "only quote"')[0].quote, "only quote", "no label → first quoted span");
});

const RULE_PART = 'rule: "Never use `console.log` in src/." (`.claude/rules/logging.md:2`)';
const REPRO_PART = 'repro: "node --test test/pages.test.js" -> "not ok 1 - pageCount(10, 5) expected 2 got 3"';
const REPRO = { command: "node --test test/pages.test.js", output: "not ok 1 - pageCount(10, 5) expected 2 got 3" };

test("parseFailFindings: repro matrix over rule:/repro: presence", () => {
  const cases = [
    { name: "rule only", line: `- FAIL: drift — \`src/a.js:4\` — ${RULE_PART} — confidence 90`, quote: "Never use `console.log` in src/.", repro: null },
    { name: "repro only", line: `- FAIL: bug — \`src/pages.js:2\` — off by one — ${REPRO_PART} — confidence 95`, quote: null, repro: REPRO },
    { name: "both", line: `- FAIL: bug — \`src/pages.js:2\` — ${RULE_PART} — ${REPRO_PART} — confidence 95`, quote: "Never use `console.log` in src/.", repro: REPRO },
    { name: "repro before rule", line: `- FAIL: bug — \`src/pages.js:2\` — ${REPRO_PART} — ${RULE_PART}`, quote: "Never use `console.log` in src/.", repro: REPRO },
    { name: "neither", line: "- FAIL: scope — src/logger.js:1 — file outside the task — confidence 90", quote: null, repro: null },
    { name: "malformed repro without ->", line: '- FAIL: bug — `src/pages.js:2` — repro: "node --test" "not ok" — confidence 95', quote: null, repro: null },
    { name: "repro with empty command", line: '- FAIL: bug — `src/pages.js:2` — repro: "" -> "not ok"', quote: null, repro: null },
    { name: "repro with empty output", line: '- FAIL: bug — `src/pages.js:2` — repro: "npm test" -> ""', quote: null, repro: { command: "npm test", output: "" } },
    { name: "repro without spaces around ->", line: '- FAIL: bug — `src/pages.js:2` — repro:"npm test"->"1 failed"', quote: null, repro: { command: "npm test", output: "1 failed" } },
  ];
  for (const c of cases) {
    const [f] = parseFailFindings(c.line);
    assert.ok(f, c.name);
    assert.equal(f.quote, c.quote, `${c.name}: quote`);
    assert.deepEqual(f.repro, c.repro, `${c.name}: repro`);
  }
});

test("parseFailFindings: a repro: line inside a fenced block is not a finding", () => {
  const text = ["```", `- FAIL: bug — \`src/pages.js:2\` — ${REPRO_PART}`, "```"].join("\n");
  assert.deepEqual(parseFailFindings(text), []);
});

test("parseFailFindings: every finding carries the repro field, null without a repro:", () => {
  assert.ok(parseFailFindings(REPORT).every((f) => f.repro === null));
});

test("parseFailFindings: garbage input → empty list, never throws", () => {
  for (const bad of [undefined, null, 42, {}, "", "no findings here"]) assert.deepEqual(parseFailFindings(bad), []);
});

test("buildFindingQuestions: one Noul per finding, sensitive files stripped from the diff", () => {
  const r = buildFindingQuestions(parseFailFindings(REPORT), DIFF);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.deepEqual(Object.keys(r.questions), ["finding_1", "finding_2"]);
  assert.equal(r.questions.finding_1.type, "noul");
  assert.match(r.questions.finding_1.instructions, /findings\[0\]/);
  assert.doesNotMatch(r.state.diff, /TOKEN=abc/);
  assert.deepEqual(r.omitted, [".env"]);
  assert.equal(r.state.findings.length, 2);
});

test("buildFindingQuestions: skip reasons instead of sending anything questionable", () => {
  const f = parseFailFindings(REPORT);
  assert.deepEqual(buildFindingQuestions([], DIFF), { ok: false, reason: "no-findings" });
  assert.deepEqual(buildFindingQuestions(f, ""), { ok: false, reason: "empty-diff" });
  assert.deepEqual(buildFindingQuestions(f, "diff --git a/.env b/.env\n+X=1"), { ok: false, reason: "empty-diff" });
  assert.deepEqual(buildFindingQuestions(f, DIFF, 10), { ok: false, reason: "too-large" });
});

test("annotateFindings: never drops or downgrades a FAIL — low score only adds a note, missing answer is unjudged", () => {
  const f = parseFailFindings(REPORT);
  const a = annotateFindings(f, { finding_1: { noul: 0.92 }, finding_2: { noul: 0.2 } });
  assert.equal(a.length, f.length);
  assert.ok(a.every((x) => x.marker === "FAIL:"));
  assert.equal(a[0].verdict, "confirmed");
  assert.equal(a[0].note, null);
  assert.equal(a[1].verdict, "not-confirmed");
  assert.match(a[1].note, /did not confirm \(0\.20\)/);
  const none = annotateFindings(f, {});
  assert.equal(none.length, 2);
  assert.ok(none.every((x) => x.verdict === "unjudged" && x.p === null));
});

test("annotateFindings: threshold is inclusive at 0.5", () => {
  const f = parseFailFindings(REPORT);
  const a = annotateFindings(f, { finding_1: { noul: 0.5 }, finding_2: { noul: 0.4999 } });
  assert.equal(a[0].verdict, "confirmed");
  assert.equal(a[1].verdict, "not-confirmed");
});
