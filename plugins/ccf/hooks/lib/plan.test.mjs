// Tests for lib/plan.mjs — node --test, no dependency.
// Guards the behavior of findActiveTask (in-progress OR in-review) used by session-start.mjs.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findActiveTask, findNonDoneTasks, findHintTask } from "./plan.mjs";

/** Write `content` to a fresh temp file and return its path. */
function tmpFile(content) {
  const dir = mkdtempSync(join(tmpdir(), "ccf-plan-test-"));
  const file = join(dir, "PLAN.md");
  writeFileSync(file, content, "utf8");
  return { file, dir };
}

test("findActiveTask: returns id + title from the in-progress row", () => {
  const { file, dir } = tmpFile(
    [
      "| ID | Slice | Layers | Gate | Pred | Status |",
      "| 001 | Wire it up | api | unit | — | done |",
      "| 003 | Add auth flow | api+ui | integration | 002 | in-progress |",
    ].join("\n"),
  );
  try {
    const task = findActiveTask(file);
    assert.deepEqual(task, { id: "003", title: "Add auth flow" });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("findActiveTask: returns id + title from an in-review row", () => {
  const { file, dir } = tmpFile(
    [
      "| ID | Slice | Layers | Gate | Pred | Status |",
      "| 001 | Wire it up | api | unit | — | done |",
      "| 004 | Awaiting review | api+ui | integration | 002 | in-review |",
    ].join("\n"),
  );
  try {
    const task = findActiveTask(file);
    assert.deepEqual(task, { id: "004", title: "Awaiting review" });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("findActiveTask: tolerates 'in review' with a space", () => {
  const { file, dir } = tmpFile("| 008 | Spaced review | x | y | — | in review |");
  try {
    assert.deepEqual(findActiveTask(file), { id: "008", title: "Spaced review" });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("findActiveTask: tolerates 'in progress' with a space", () => {
  const { file, dir } = tmpFile("| 007 | Spaced status | x | y | — | in progress |");
  try {
    assert.deepEqual(findActiveTask(file), { id: "007", title: "Spaced status" });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("findActiveTask: returns null when no row is in-progress or in-review", () => {
  const { file, dir } = tmpFile("| 001 | Done slice | x | y | — | done |");
  try {
    assert.equal(findActiveTask(file), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("findActiveTask: returns null for todo/blocked rows", () => {
  const { file, dir } = tmpFile(
    [
      "| 001 | Not started | x | y | — | todo |",
      "| 002 | Stuck slice | x | y | — | blocked |",
    ].join("\n"),
  );
  try {
    assert.equal(findActiveTask(file), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("findActiveTask: returns null when the file does not exist", () => {
  assert.equal(findActiveTask(join(tmpdir(), "no-such-plan-xyz.md")), null);
});

test("findActiveTask: does NOT match a done row whose TITLE contains 'in-progress'", () => {
  // Bug #2/#4: the status is `done`; the words 'in-progress' only appear in the title.
  const { file, dir } = tmpFile("| 001 | Add in-progress indicator | x | y | — | done |");
  try {
    assert.equal(findActiveTask(file), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("findActiveTask: does NOT match a done row whose TITLE contains 'in-review'", () => {
  // Positional guard: 'in-review' in the title cell must not match — only the status cell counts.
  const { file, dir } = tmpFile("| 001 | Add in-review indicator | x | y | — | done |");
  try {
    assert.equal(findActiveTask(file), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("findActiveTask: does NOT treat prose lines as rows even with 'in progress'", () => {
  // A note line that is not a table row (no leading pipe) must be ignored.
  const { file, dir } = tmpFile("Status legend: pending / in-progress / done\n| 002 | Real task | x | done |");
  try {
    assert.equal(findActiveTask(file), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("findActiveTask: preserves a title containing an escaped pipe", () => {
  // Bug #3: a `\|` inside the title cell must not split the column.
  const { file, dir } = tmpFile("| 003 | Fix a\\|b parser | x | y | — | in-progress |");
  try {
    assert.deepEqual(findActiveTask(file), { id: "003", title: "Fix a|b parser" });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("findActiveTask: skips the header + separator rows", () => {
  const { file, dir } = tmpFile(
    [
      "| ID | Slice | Status |",
      "| --- | --- | --- |",
      "| 005 | Build it | in-progress |",
    ].join("\n"),
  );
  try {
    assert.deepEqual(findActiveTask(file), { id: "005", title: "Build it" });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("findActiveTask: empty id cell does NOT shift columns (id stays empty, title stays title)", () => {
  // Bug #1: keeping empty cells positional means a blank id no longer steals the title's slot.
  const { file, dir } = tmpFile("|  | Title here | in-progress |");
  try {
    assert.deepEqual(findActiveTask(file), { id: "", title: "Title here" });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("findNonDoneTasks: returns every row whose status is not 'done'", () => {
  const { file, dir } = tmpFile(
    [
      "| ID | Slice | Layers | Gate | Pred | Status |",
      "| --- | --- | --- | --- | --- | --- |",
      "| 001 | Wire it up | api | unit | — | done |",
      "| 002 | Not started | api | unit | — | todo |",
      "| 003 | Building it | api+ui | integration | 002 | in-progress |",
      "| 004 | Awaiting review | api+ui | integration | 003 | in-review |",
      "| 005 | Stuck slice | api | unit | — | blocked |",
    ].join("\n"),
  );
  try {
    assert.deepEqual(findNonDoneTasks(file), [
      { id: "002", title: "Not started", status: "todo" },
      { id: "003", title: "Building it", status: "in-progress" },
      { id: "004", title: "Awaiting review", status: "in-review" },
      { id: "005", title: "Stuck slice", status: "blocked" },
    ]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("findNonDoneTasks: returns [] when every row is done", () => {
  const { file, dir } = tmpFile(
    [
      "| ID | Slice | Status |",
      "| 001 | First | done |",
      "| 002 | Second | done |",
    ].join("\n"),
  );
  try {
    assert.deepEqual(findNonDoneTasks(file), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("findNonDoneTasks: returns [] when the file does not exist", () => {
  assert.deepEqual(findNonDoneTasks(join(tmpdir(), "no-such-plan-xyz.md")), []);
});

test("findNonDoneTasks: resolves the Status column dynamically when it is NOT the last column (real-world bug: `| # | Task | Status | Predecessor |`)", () => {
  // Reproduces the reported bug: hardcoding "status = last cell" would read the Predecessor
  // value ("—" / a task id) as the status, making every row look "not done" even when the real
  // Status column says "done".
  const { file, dir } = tmpFile(
    [
      "| # | Task | Status | Predecessor |",
      "| --- | --- | --- | --- |",
      "| 001 | First task | done | — |",
      "| 002 | Second task | in-review | 001 |",
      "| 003 | Third task | todo | 002 |",
    ].join("\n"),
  );
  try {
    assert.deepEqual(findNonDoneTasks(file), [
      { id: "002", title: "Second task", status: "in-review" },
      { id: "003", title: "Third task", status: "todo" },
    ]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("findActiveTask: resolves the Status column dynamically when it is NOT the last column", () => {
  const { file, dir } = tmpFile(
    [
      "| # | Task | Status | Predecessor |",
      "| --- | --- | --- | --- |",
      "| 001 | First task | done | — |",
      "| 002 | Second task | in-review | 001 |",
    ].join("\n"),
  );
  try {
    assert.deepEqual(findActiveTask(file), { id: "002", title: "Second task" });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("findNonDoneTasks: a header row with no following separator row does not itself leak as a phantom task (id '#', defense-in-depth)", () => {
  const { file, dir } = tmpFile(
    ["| # | Task | Status | Predecessor |", "| 001 | First task | done | — |"].join("\n"),
  );
  try {
    // No separator row → isHeaderRow can't detect the header structurally (the PRIMARY defense
    // needs a well-formed table, which every observed real PLAN.md has); the backup guard (id
    // === "#") still keeps the header row ITSELF out of the result — the exact leak this was
    // filed against. Resolving the data row's own status correctly still needs the separator.
    assert.equal(
      findNonDoneTasks(file).some((t) => t.id === "#"),
      false,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("findNonDoneTasks: ignores the header + separator rows (not counted as non-done)", () => {
  const { file, dir } = tmpFile(
    [
      "| ID | Slice | Status |",
      "| --- | --- | --- |",
      "| 005 | Build it | in-progress |",
    ].join("\n"),
  );
  try {
    // The header row's status cell is the literal "Status" (not "done") but it is NOT a task; the
    // separator row is dashes. Only the real task row may appear in the result.
    assert.deepEqual(findNonDoneTasks(file), [
      { id: "005", title: "Build it", status: "in-progress" },
    ]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// --- findHintTask ------------------------------------------------------------

test("findHintTask: prefers the active (in-progress/in-review) task over any todo task", () => {
  const { file, dir } = tmpFile(
    [
      "| # | Task | Status | Predecessor |",
      "| --- | --- | --- | --- |",
      "| 001 | Not started | todo | — |",
      "| 002 | Being built | in-progress | 001 |",
    ].join("\n"),
  );
  try {
    assert.deepEqual(findHintTask(file), { id: "002", title: "Being built" });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("findHintTask: falls back to the first 'todo' task when nothing is active (the compact-hint bug fix — was generic-only)", () => {
  const { file, dir } = tmpFile(
    [
      "| # | Task | Status | Predecessor |",
      "| --- | --- | --- | --- |",
      "| 001 | Just finished | done | — |",
      "| 002 | Next up | todo | 001 |",
      "| 003 | Later | todo | 002 |",
    ].join("\n"),
  );
  try {
    assert.deepEqual(findHintTask(file), { id: "002", title: "Next up" });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("findHintTask: returns null when every task is done or blocked (nothing left to hint)", () => {
  const { file, dir } = tmpFile(
    [
      "| # | Task | Status | Predecessor |",
      "| --- | --- | --- | --- |",
      "| 001 | Done one | done | — |",
      "| 002 | Stuck one | blocked | 001 |",
    ].join("\n"),
  );
  try {
    assert.equal(findHintTask(file), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("findNonDoneTasks: 'dropped' is a CLOSED status (deliberately abandoned), same as 'done' — not nagged forever", () => {
  const { file, dir } = tmpFile(
    [
      "| # | Task | Status | Predecessor |",
      "| --- | --- | --- | --- |",
      "| 001 | Finished | done | — |",
      "| 002 | Abandoned by decision | dropped | 001 |",
      "| 003 | Still open | blocked | 002 |",
    ].join("\n"),
  );
  try {
    // 'dropped' is closed like 'done'; 'blocked' stays open — the nudge should only ever surface 003.
    assert.deepEqual(findNonDoneTasks(file), [
      { id: "003", title: "Still open", status: "blocked" },
    ]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
