// Tests for lib/archive.mjs — node --test, no dependency.
// Guards the retirement decision + the two file rewrites, so scripts/archive-plan.mjs can never
// cut the wrong lines out of PLAN.md or drop history on the floor.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync, readFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseIterations,
  isRetirable,
  retirePlan,
  insertIntoArchive,
  findRetirableIterationsIn,
  planTaskFilePrune,
  findPrunableTaskFilesIn,
} from "./archive.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PLAN_PATH = join(HERE, "..", "..", "templates", "root", ".claude", "plan", "PLAN.md.tmpl");
// One shared read: the template is a read-only fixture no test mutates, so the three
// REAL-template tests below derive from this instead of each re-reading the file.
const TEMPLATE_RAW = readFileSync(TEMPLATE_PLAN_PATH, "utf8");

// The guidance blocks that must always live in the template's preamble (task 050 FAIL A).
const GUIDANCE_PATTERNS = [
  [/Write the status as a \*\*bare word\*\*/, "the bare-word guidance"],
  [/Status: `todo` \/ `in-progress` \/ `in-review` \/ `done` \/ `accepted` \/ `blocked`/, "the status legend line"],
  [/`accepted`[^\n]*\.claude\/plan\/PENDING\.md/, "the accepted-status meaning, tied to PENDING.md"],
  [/\*\*Keep this file to the CURRENT iteration\.\*\*/, "the archive-vs-delete guidance"],
  // Task 072: the retention rule replaced "archive, never delete", so the preamble must say what is kept
  // and how a pruned task file comes back.
  [/task files of the newest 10 iterations/, "the retention rule"],
  [/git log --diff-filter=D --name-only -- \.claude\/plan\/archive\//, "the recovery command"],
];

/**
 * Assert every guidance block is present in the given text — shared by the preamble latch and
 * the single-iteration retirement test so a future rewording is updated in exactly one place.
 * @param {string} text the text to scan
 * @param {string} where names the scanned text in assertion failures
 * @returns {void}
 */
function assertGuidancePresent(text, where) {
  for (const [re, what] of GUIDANCE_PATTERNS) {
    assert.match(text, /** @type {RegExp} */ (re), `${what} must be present in ${where}`);
  }
}

/**
 * Flip the template's sample `| todo |` rows to `| done |` so its iteration reads as retirable —
 * the one fixture transform both retirement tests share, in one shape instead of two.
 * @param {string} text template text
 * @returns {string}
 */
function flipTodoRowsToDone(text) {
  return text.replace(/\| todo \|$/gm, "| done |");
}

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

test("isRetirable: an iteration whose rows are all `accepted` is retirable", () => {
  const its = parseIterations(
    L("## Origin — accepted\n| # | Slice | L | G | D | Status |\n|---|---|---|---|---|---|\n| 001 | s | a | u | — | accepted |\n| 002 | t | a | u | — | Accepted |"),
  );
  assert.equal(isRetirable(its[0]), true);
});

test("isRetirable: a mix of `done` and `accepted` is retirable, `accept` is not", () => {
  const mixed = parseIterations(
    L("## Origin — mixed\n| # | Slice | L | G | D | Status |\n|---|---|---|---|---|---|\n| 001 | s | a | u | — | done |\n| 002 | t | a | u | — | accepted |"),
  );
  const nearMiss = parseIterations(
    L("## Origin — near miss\n| # | Slice | L | G | D | Status |\n|---|---|---|---|---|---|\n| 001 | s | a | u | — | done |\n| 002 | t | a | u | — | accept |"),
  );
  assert.equal(isRetirable(mixed[0]), true);
  assert.equal(isRetirable(nearMiss[0]), false);
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

test("REAL PLAN.md.tmpl: the status guidance sits in the PREAMBLE, before the first ## Origin (task 050 FAIL A, case 1 — the direct latch)", () => {
  // This is the test that actually bites: it goes RED the instant the guidance is moved back below
  // "## Origin", with no retirement machinery in between. A prior version of this file instead built a
  // two-iteration document that duplicated the guidance into BOTH iterations, so retiring one iteration
  // always left a surviving copy and the assertion passed regardless of where the guidance really was —
  // see the round-2 review finding recorded in task-050's notes for the reproduction.
  const originIdx = TEMPLATE_RAW.indexOf("## Origin:");
  assert.ok(originIdx > 0, "the template must carry a preamble before its first ## Origin heading");
  assertGuidancePresent(TEMPLATE_RAW.slice(0, originIdx), "the preamble");
});

test("REAL PLAN.md.tmpl: retiring the template's OWN (only) iteration keeps the status guidance (task 050 FAIL A, case 2 — single-iteration retirement)", () => {
  // The real-world first retirement a generated project ever performs: ONE iteration, no sibling to
  // fall back on. This is the exact scenario the round-2 review reproduced the bug on — the previous
  // two-iteration test never exercised it at all.
  const lines = flipTodoRowsToDone(TEMPLATE_RAW).split(/\r?\n/);
  const its = parseIterations(lines);
  assert.equal(its.length, 1, "the shipped template carries exactly one Origin heading");
  assert.equal(isRetirable(its[0]), true, "both sample rows were flipped to done");
  const { planText } = retirePlan(lines, its[0]);
  assertGuidancePresent(planText, "planText after retiring the template's only iteration (it survives because it sits ABOVE ## Origin, in the preamble)");
});

test("REAL PLAN.md.tmpl shape: a sibling iteration's header row survives retiring the OTHER iteration (sibling-iteration survival, not the FAIL A case)", () => {
  // Renamed from its previous "FAIL 1 regression" name: this scenario (two iterations, retire one,
  // the OTHER keeps its own Task backlog header) never exercised the single-iteration bug above and
  // must not be read as guarding it. Kept because it documents a real, different property: a real
  // project's PLAN.md accumulates iterations the same way this repo's own PLAN.md does, each with its
  // own "## Task backlog" (and its own header row).
  const originIdx = TEMPLATE_RAW.indexOf("## Origin:");
  const preamble = TEMPLATE_RAW.slice(0, originIdx);
  const shippedIteration = TEMPLATE_RAW.slice(originIdx);
  const olderIteration = flipTodoRowsToDone(shippedIteration.replace("{{ITERATION_NAME}}", "older-iteration"));
  const twoIterationDoc = `${preamble}${shippedIteration}\n${olderIteration}`;
  const lines = twoIterationDoc.split(/\r?\n/);
  const its = parseIterations(lines);
  assert.equal(its.length, 2, "the shipped template iteration plus the synthetic older one");
  const older = its.find((it) => it.heading.includes("older-iteration"));
  assert.ok(older, "the synthetic older iteration must be found by its Origin heading");
  assert.equal(isRetirable(older), true, "both its sample rows were flipped to done");
  const { planText } = retirePlan(lines, older);
  assert.match(
    planText,
    /\| # \| Slice \| Layers \| Gate \(tests green\) \| Depends on \| Status \|/,
    "the surviving (newer) iteration keeps its own Task backlog header row",
  );
});

test("findRetirableIterationsIn: a directory in place of the file yields [] instead of throwing", () => {
  const dir = mkdtempSync(join(tmpdir(), "ccf-archive-test-"));
  try {
    assert.deepEqual(findRetirableIterationsIn(dir), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// =================================================================================================
// planTaskFilePrune / findPrunableTaskFilesIn (task 070). Contract matrix:
//   EP  file name: kept-iteration id | old-iteration id | orphan | non-task file | suffixed id (034a)
//   BVA iteration count {0, 9, 10, 11} with keep 10; keep {1, 10}; an iteration with zero task rows;
//       an empty archive/ dir. (keep 0 is rejected by the script, see prune-archive-script.test.mjs.)
// =================================================================================================

/**
 * An ARCHIVE.md body with `n` iterations, newest first. Iteration k (0-based) owns task id
 * 100 + n - k, so the newest iteration carries the highest id, like the real archive.
 * @param {number} n
 * @returns {string[]}
 */
function archiveWith(n) {
  const out = ["# Archive", "", "> preamble"];
  for (let k = 0; k < n; k++) {
    const id = String(100 + n - k);
    out.push("", `## Origin: it-${id}`, "", "| # | Slice | Status |", "|---|---|---|", `| ${id} | slice ${id} | done |`);
  }
  return out;
}

/** @param {number[]} ids @returns {string[]} */
const filesFor = (ids) => ids.map((id) => `task-${id}-x.md`);

test("planTaskFilePrune: BVA iteration count 0 → every task file is an orphan, nothing pruned", () => {
  assert.deepEqual(planTaskFilePrune(archiveWith(0), ["task-001-a.md"], 10), {
    keepIds: [],
    prune: [],
    orphans: ["task-001-a.md"],
  });
});

test("planTaskFilePrune: BVA 9 and 10 iterations with keep 10 → nothing pruned", () => {
  for (const n of [9, 10]) {
    const ids = Array.from({ length: n }, (_, k) => 101 + k);
    const r = planTaskFilePrune(archiveWith(n), filesFor(ids), 10);
    assert.deepEqual(r.prune, [], `n=${n}`);
    assert.deepEqual(r.orphans, [], `n=${n}`);
    assert.equal(r.keepIds.length, n);
  }
});

test("planTaskFilePrune: BVA 11 iterations with keep 10 → exactly the oldest iteration's file is pruned", () => {
  const ids = Array.from({ length: 11 }, (_, k) => 101 + k);
  const r = planTaskFilePrune(archiveWith(11), filesFor(ids), 10);
  assert.deepEqual(r.prune, ["task-101-x.md"]);
  assert.deepEqual(r.orphans, []);
  assert.ok(!r.keepIds.includes("101"));
});

test("planTaskFilePrune: BVA keep 1 → only the newest iteration is kept", () => {
  const r = planTaskFilePrune(archiveWith(3), filesFor([101, 102, 103]), 1);
  assert.deepEqual(r.keepIds, ["103"]);
  assert.deepEqual(r.prune, ["task-101-x.md", "task-102-x.md"]);
});

test("planTaskFilePrune: EP file names — kept, old, orphan, non-task, suffixed id", () => {
  const lines = [
    "## Origin: new", "| # | Slice | Status |", "|---|---|---|", "| 034 | a | done |", "| 034a | live verify | done |",
    "## Origin: old", "| # | Slice | Status |", "|---|---|---|", "| 020 | b | done |", "| 020a | c | done |",
  ];
  const files = ["task-034-a.md", "task-034a-live.md", "task-020-b.md", "task-020a-c.md", "task-009-orphan.md", "README.md", "notes.txt", "task-abc-x.md"];
  const r = planTaskFilePrune(lines, files, 1);
  assert.deepEqual(r.keepIds, ["034", "034a"]);
  assert.deepEqual(r.prune, ["task-020-b.md", "task-020a-c.md"]);
  assert.deepEqual(r.orphans, ["task-009-orphan.md"]);
});

test("planTaskFilePrune: an id in both a kept and an older iteration is kept (fail-safe), never pruned", () => {
  const lines = [
    "## Origin: new", "| # | Slice | Status |", "|---|---|---|", "| 050 | redo | done |",
    "## Origin: old", "| # | Slice | Status |", "|---|---|---|", "| 050 | first | done |", "| 049 | x | done |",
  ];
  const r = planTaskFilePrune(lines, ["task-050-a.md", "task-049-b.md"], 1);
  assert.deepEqual(r.prune, ["task-049-b.md"]);
  assert.ok(r.keepIds.includes("050"));
});

test("planTaskFilePrune: an iteration with zero task rows still counts toward keep (positional)", () => {
  const lines = [
    "## Origin: new", "| # | Slice | Status |", "|---|---|---|", "| 012 | a | done |",
    "## Origin: cleanup, no table",
    "## Origin: old", "| # | Slice | Status |", "|---|---|---|", "| 010 | b | done |",
  ];
  assert.deepEqual(planTaskFilePrune(lines, ["task-012-a.md", "task-010-b.md"], 2).prune, ["task-010-b.md"]);
});

test("planTaskFilePrune: an empty file list → nothing pruned, no orphans", () => {
  const r = planTaskFilePrune(archiveWith(12), [], 10);
  assert.deepEqual([r.prune, r.orphans], [[], []]);
  assert.equal(r.keepIds.length, 10);
});

test("findPrunableTaskFilesIn: missing ARCHIVE.md, missing archive/ or empty archive/ → empty result, never throws", () => {
  const dir = mkdtempSync(join(tmpdir(), "ccf-prune-lib-"));
  try {
    const empty = { keepIds: [], prune: [], orphans: [] };
    assert.deepEqual(findPrunableTaskFilesIn(join(dir, "nope"), 10), empty);
    assert.deepEqual(findPrunableTaskFilesIn(dir, 10), empty);
    writeFileSync(join(dir, "ARCHIVE.md"), archiveWith(11).join("\n"));
    assert.deepEqual(findPrunableTaskFilesIn(dir, 10).prune, [], "no archive/ dir");
    mkdirSync(join(dir, "archive"));
    assert.deepEqual(findPrunableTaskFilesIn(dir, 10).prune, [], "empty archive/ dir");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("findPrunableTaskFilesIn: reads ARCHIVE.md + archive/ and returns the planTaskFilePrune decision", () => {
  const dir = mkdtempSync(join(tmpdir(), "ccf-prune-lib-"));
  try {
    writeFileSync(join(dir, "ARCHIVE.md"), archiveWith(11).join("\n"));
    mkdirSync(join(dir, "archive"));
    for (const f of ["task-101-x.md", "task-111-x.md", "task-001-orphan.md"]) writeFileSync(join(dir, "archive", f), "x");
    const r = findPrunableTaskFilesIn(dir, 10);
    assert.deepEqual(r.prune, ["task-101-x.md"]);
    assert.deepEqual(r.orphans, ["task-001-orphan.md"]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
