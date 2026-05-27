// Tests for lib/plan.mjs — node --test, no dependency.
// Guards the behavior of findInProgressTask after it is extracted from session-start.mjs.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findInProgressTask } from "./plan.mjs";

/** Write `content` to a fresh temp file and return its path. */
function tmpFile(content) {
  const dir = mkdtempSync(join(tmpdir(), "ccf-plan-test-"));
  const file = join(dir, "PLAN.md");
  writeFileSync(file, content, "utf8");
  return { file, dir };
}

test("findInProgressTask: returns id + title from the in-progress row", () => {
  const { file, dir } = tmpFile(
    [
      "| ID | Slice | Layers | Gate | Pred | Status |",
      "| 001 | Wire it up | api | unit | — | done |",
      "| 003 | Add auth flow | api+ui | integration | 002 | in-progress |",
    ].join("\n"),
  );
  try {
    const task = findInProgressTask(file);
    assert.deepEqual(task, { id: "003", title: "Add auth flow" });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("findInProgressTask: tolerates 'in progress' with a space", () => {
  const { file, dir } = tmpFile("| 007 | Spaced status | x | y | — | in progress |");
  try {
    assert.deepEqual(findInProgressTask(file), { id: "007", title: "Spaced status" });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("findInProgressTask: returns null when no row is in-progress", () => {
  const { file, dir } = tmpFile("| 001 | Done slice | x | y | — | done |");
  try {
    assert.equal(findInProgressTask(file), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("findInProgressTask: returns null when the file does not exist", () => {
  assert.equal(findInProgressTask(join(tmpdir(), "no-such-plan-xyz.md")), null);
});

test("findInProgressTask: does NOT match a done row whose TITLE contains 'in-progress'", () => {
  // Bug #2/#4: the status is `done`; the words 'in-progress' only appear in the title.
  const { file, dir } = tmpFile("| 001 | Add in-progress indicator | x | y | — | done |");
  try {
    assert.equal(findInProgressTask(file), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("findInProgressTask: does NOT treat prose lines as rows even with 'in progress'", () => {
  // A note line that is not a table row (no leading pipe) must be ignored.
  const { file, dir } = tmpFile("Status legend: pending / in-progress / done\n| 002 | Real task | x | done |");
  try {
    assert.equal(findInProgressTask(file), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("findInProgressTask: preserves a title containing an escaped pipe", () => {
  // Bug #3: a `\|` inside the title cell must not split the column.
  const { file, dir } = tmpFile("| 003 | Fix a\\|b parser | x | y | — | in-progress |");
  try {
    assert.deepEqual(findInProgressTask(file), { id: "003", title: "Fix a|b parser" });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("findInProgressTask: skips the header + separator rows", () => {
  const { file, dir } = tmpFile(
    [
      "| ID | Slice | Status |",
      "| --- | --- | --- |",
      "| 005 | Build it | in-progress |",
    ].join("\n"),
  );
  try {
    assert.deepEqual(findInProgressTask(file), { id: "005", title: "Build it" });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("findInProgressTask: empty id cell does NOT shift columns (id stays empty, title stays title)", () => {
  // Bug #1: keeping empty cells positional means a blank id no longer steals the title's slot.
  const { file, dir } = tmpFile("|  | Title here | in-progress |");
  try {
    assert.deepEqual(findInProgressTask(file), { id: "", title: "Title here" });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
