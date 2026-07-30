// Tests for lib/archive.mjs — node --test, no dependency.
// Guards the retirement decision + the two file rewrites, so scripts/archive-plan.mjs can never
// cut the wrong lines out of PLAN.md or drop history on the floor.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  parseIterations,
  isRetirable,
  retirePlan,
  insertIntoArchive,
  findRetirableIterationsIn,
} from "./archive.mjs";

/** Split a template block into lines the way the lib expects. */
const L = (s) => s.split("\n");

// A PLAN.md whose two iterations reproduce the REAL shapes found in this repo's ARCHIVE.md:
// the Origin heading and the Task backlog heading carry DIFFERENT names, and one backlog heading
// carries no name at all — which is exactly why grouping is positional, not by name.
const TWO_ITERATIONS = `# Implementation Plan

> Preamble blockquote, belongs to no iteration.

## Origin — second-thing → renamed midway (tasks 003-004) — OPEN
Origin prose for the newer iteration.

## Task backlog (in execution order)
| # | Slice | Layers | Gate | Depends on | Status |
|---|-------|--------|------|-----------|--------|
| 003 | Newer slice | api | unit | — | in-review |
| 004 | Newest slice | ui | unit | 003 | todo |

> Trailing note attached to the newer backlog.

## Origin — first-thing (tasks 001-002) — DONE
Origin prose for the older iteration.

## Task backlog — totally different wording here
| # | Slice | Layers | Gate | Depends on | Status |
|---|-------|--------|------|-----------|--------|
| 001 | Older slice | api | unit | — | done |
| 002a | Older follow-up | api | unit | 001 | dropped |

## Closed — first-thing
Postmortem prose for the older iteration.`;

test("parseIterations: groups positionally from one Origin heading to the next", () => {
  const its = parseIterations(L(TWO_ITERATIONS));
  assert.equal(its.length, 2);
  assert.match(its[0].heading, /second-thing/);
  assert.match(its[1].heading, /first-thing/);
  // The older iteration must own its Task backlog AND its Closed section, despite the headings
  // sharing no common name with its Origin heading.
  const olderText = its[1].lines.join("\n");
  assert.match(olderText, /totally different wording/);
  assert.match(olderText, /Postmortem prose/);
});

test("parseIterations: the preamble before the first Origin belongs to no iteration", () => {
  const its = parseIterations(L(TWO_ITERATIONS));
  for (const it of its) {
    assert.ok(!it.lines.join("\n").includes("Preamble blockquote"));
  }
  assert.ok(its[0].start > 0, "first iteration must not start at line 0");
});

test("parseIterations: reads task rows of the iteration it belongs to only", () => {
  const its = parseIterations(L(TWO_ITERATIONS));
  assert.deepEqual(
    its[0].rows.map((r) => r.id),
    ["003", "004"],
  );
  assert.deepEqual(
    its[1].rows.map((r) => r.id),
    ["001", "002a"],
  );
});

test("parseIterations: an Origin with no task table yields zero rows, not a crash", () => {
  const its = parseIterations(L("## Origin — bare note (post-hoc cleanup)\nJust prose, no table."));
  assert.equal(its.length, 1);
  assert.deepEqual(its[0].rows, []);
});

test("parseIterations: ignores an Origin heading inside a fenced code block", () => {
  const its = parseIterations(
    L("## Origin — real one (tasks 001) — DONE\n\n```md\n## Origin — this is an EXAMPLE, not an iteration\n```\n\ntail prose"),
  );
  assert.equal(its.length, 1);
  assert.match(its[0].lines.join("\n"), /tail prose/);
});

test("parseIterations: no Origin heading at all yields an empty list", () => {
  assert.deepEqual(parseIterations(L("# Plan\n\nNothing structured here.")), []);
});

test("isRetirable: every row closed → true", () => {
  const its = parseIterations(L(TWO_ITERATIONS));
  assert.equal(isRetirable(its[1]), true, "done + dropped are both CLOSED statuses");
});

test("isRetirable: one open row → false", () => {
  const its = parseIterations(L(TWO_ITERATIONS));
  assert.equal(isRetirable(its[0]), false, "in-review + todo are open");
});

test("isRetirable: an iteration with NO task rows is never retirable", () => {
  // Guard against archiving a freshly-created iteration whose backlog table isn't written yet:
  // "every row is closed" is vacuously true for zero rows, which would silently delete live work.
  const its = parseIterations(L("## Origin — brand new, backlog not written yet"));
  assert.equal(isRetirable(its[0]), false);
});

test("isRetirable: a markdown-emphasised status cell still reads as closed", () => {
  // Same class of bug plan.mjs#stripEmphasis already fixed: `**done**` must not read as open.
  const its = parseIterations(
    L("## Origin — emphasised\n| # | Slice | L | G | D | Status |\n|---|---|---|---|---|---|\n| 001 | s | a | u | — | **done** |"),
  );
  assert.equal(isRetirable(its[0]), true);
});

test("retirePlan: removes exactly the iteration's lines and returns them verbatim", () => {
  const lines = L(TWO_ITERATIONS);
  const its = parseIterations(lines);
  const { planText, archiveEntry } = retirePlan(lines, its[1]);
  // The retired iteration is gone from the plan...
  assert.ok(!planText.includes("first-thing"));
  assert.ok(!planText.includes("Postmortem prose"));
  // ...the surviving iteration and the preamble are untouched...
  assert.ok(planText.includes("Preamble blockquote"));
  assert.ok(planText.includes("second-thing"));
  assert.ok(planText.includes("| 004 | Newest slice"));
  // ...and the entry carries the retired text verbatim, headings included.
  assert.match(archiveEntry, /^## Origin — first-thing/);
  assert.match(archiveEntry, /Postmortem prose/);
  assert.match(archiveEntry, /\| 002a \| Older follow-up/);
});

test("retirePlan: works on the LAST iteration in the file (runs to EOF)", () => {
  const lines = L("# Plan\n\n## Origin — only one — DONE\n| # | S | L | G | D | Status |\n|---|---|---|---|---|---|\n| 001 | s | a | u | — | done |");
  const its = parseIterations(lines);
  const { planText, archiveEntry } = retirePlan(lines, its[0]);
  assert.equal(planText.trim(), "# Plan");
  assert.match(archiveEntry, /only one/);
  assert.match(archiveEntry, /\| 001 \| s \|/);
});

test("retirePlan: exposes the task ids so the caller can move their files", () => {
  const lines = L(TWO_ITERATIONS);
  const its = parseIterations(lines);
  assert.deepEqual(retirePlan(lines, its[1]).taskIds, ["001", "002a"]);
});

test("retirePlan: a non-numeric id cell is not mistaken for a task file", () => {
  const lines = L(
    "## Origin — noisy table\n| # | S | L | G | D | Status |\n|---|---|---|---|---|---|\n| 001 | s | a | u | — | done |\n| n/a | note row | a | u | — | done |",
  );
  const its = parseIterations(lines);
  assert.deepEqual(retirePlan(lines, its[0]).taskIds, ["001"]);
});

test("insertIntoArchive: inserts before the FIRST Origin, preserving the preamble", () => {
  const archive = "# Archive\n\n> Preamble.\n\n## Residual risk\nA general note.\n\n## Origin — older thing\nold prose";
  const out = insertIntoArchive(archive, "## Origin — newest thing\nnew prose");
  const iNew = out.indexOf("newest thing");
  const iOld = out.indexOf("older thing");
  const iRisk = out.indexOf("Residual risk");
  assert.ok(iRisk < iNew, "the general preamble note must stay above the iterations");
  assert.ok(iNew < iOld, "newest first");
  assert.ok(out.includes("> Preamble."));
});

test("insertIntoArchive: an archive with no Origin yet gets the entry appended", () => {
  const out = insertIntoArchive("# Archive\n\n> Preamble only.\n", "## Origin — first ever\nprose");
  assert.match(out, /Preamble only[\s\S]*first ever/);
  assert.match(out, /\n$/, "file should end with a newline");
});

test("insertIntoArchive: an empty/missing archive still produces a valid file", () => {
  const out = insertIntoArchive("", "## Origin — first ever\nprose");
  assert.match(out, /## Origin — first ever/);
  assert.match(out, /\n$/);
});

test("insertIntoArchive: separates the entry from what follows with a blank line", () => {
  const out = insertIntoArchive("# Archive\n\n## Origin — older\nold", "## Origin — newer\nnew");
  assert.ok(out.includes("new\n\n## Origin — older"), `entry must be blank-line separated, got:\n${out}`);
});

test("findRetirableIterationsIn: reads a real file and returns only the closed iterations", () => {
  const dir = mkdtempSync(join(tmpdir(), "ccf-archive-test-"));
  const file = join(dir, "PLAN.md");
  writeFileSync(file, TWO_ITERATIONS, "utf8");
  try {
    const found = findRetirableIterationsIn(file);
    assert.equal(found.length, 1);
    assert.match(found[0].heading, /first-thing/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("findRetirableIterationsIn: a missing file yields [] instead of throwing", () => {
  // A Stop hook must never break a session over a nudge it could not compute.
  assert.deepEqual(findRetirableIterationsIn(join(tmpdir(), "ccf-does-not-exist-8f3a", "PLAN.md")), []);
});

test("findRetirableIterationsIn: a directory in place of the file yields [] instead of throwing", () => {
  const dir = mkdtempSync(join(tmpdir(), "ccf-archive-test-"));
  try {
    assert.deepEqual(findRetirableIterationsIn(dir), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
