// Tests for lib/plan.mjs — node --test, no dependency.
// Guards the behavior of findActiveTask (in-progress OR in-review) used by session-start.mjs.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  findActiveTask,
  findNonDoneTasks,
  findInReviewTask,
  isClosedStatus,
  findOpenPendingItems,
  buildPendingReminder,
} from "./plan.mjs";

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

// Regression: a status cell wrapped in markdown emphasis. This is NOT hypothetical — this repo's own
// PLAN.md wrote `| 036 | … | **done** |` to visually stress the status, and findNonDoneTasks reported
// those rows as OPEN because CLOSED_STATUS_RE anchors `^done$` and `**done**` does not match. The
// Stop hook's clause C then named two already-finished tasks as unfinished. Emphasis is presentation,
// not data, so it must be stripped before the status is interpreted.
test("findNonDoneTasks: markdown emphasis around a status is presentation, not data — `**done**` is CLOSED", () => {
  const { file, dir } = tmpFile(
    [
      "| # | Task | Status | Predecessor |",
      "| --- | --- | --- | --- |",
      "| 001 | Bold done | **done** | — |",
      "| 002 | Italic done | *done* | 001 |",
      "| 003 | Underscore-italic done | _done_ | 002 |",
      "| 004 | Code-span done | `done` | 003 |",
      "| 005 | Bold dropped | **dropped** | 004 |",
      "| 006 | Genuinely open | in-review | 005 |",
    ].join("\n"),
  );
  try {
    assert.deepEqual(findNonDoneTasks(file), [
      { id: "006", title: "Genuinely open", status: "in-review" },
    ]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("findActiveTask: an emphasised active status (`**in-review**`) is still detected", () => {
  const { file, dir } = tmpFile(
    [
      "| ID | Slice | Status |",
      "| --- | --- | --- |",
      "| 001 | Finished | **done** |",
      "| 002 | Awaiting review | **in-review** |",
    ].join("\n"),
  );
  try {
    assert.deepEqual(findActiveTask(file), { id: "002", title: "Awaiting review" });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("findActiveTask: stripping emphasis must NOT swallow a real status word — `**blocked**` is not active", () => {
  const { file, dir } = tmpFile(
    [
      "| ID | Slice | Status |",
      "| --- | --- | --- |",
      "| 001 | Waiting on infra | **blocked** |",
    ].join("\n"),
  );
  try {
    assert.equal(findActiveTask(file), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("findInReviewTask: returns the in-review row and skips an earlier in-progress one", () => {
  const { file, dir } = tmpFile(
    [
      "| ID | Slice | Layers | Gate | Pred | Status |",
      "| 001 | Still working | api | unit | — | in-progress |",
      "| 002 | Awaiting check | api | unit | 001 | in-review |",
    ].join("\n"),
  );
  try {
    assert.deepEqual(findInReviewTask(file), { id: "002", title: "Awaiting check" });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("findInReviewTask: tolerates 'in review' and bold status, null for in-progress/todo/done only", () => {
  const spaced = tmpFile(["| ID | Slice | Status |", "| 004 | Spaced | **in review** |"].join("\n"));
  const none = tmpFile(
    ["| ID | Slice | Status |", "| 001 | A | in-progress |", "| 002 | B | todo |", "| 003 | C | done |"].join("\n"),
  );
  try {
    assert.deepEqual(findInReviewTask(spaced.file), { id: "004", title: "Spaced" });
    assert.equal(findInReviewTask(none.file), null);
  } finally {
    rmSync(spaced.dir, { recursive: true, force: true });
    rmSync(none.dir, { recursive: true, force: true });
  }
});

test("findInReviewTask: more than one in-review row is ambiguous → null (never guess which task the diff belongs to)", () => {
  const { file, dir } = tmpFile(
    ["| ID | Slice | Status |", "| 001 | A | in-review |", "| 002 | B | done |", "| 003 | C | in-review |"].join("\n"),
  );
  try {
    assert.equal(findInReviewTask(file), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("findInReviewTask: missing file → null", () => {
  assert.equal(findInReviewTask(join(tmpdir(), "no-such-plan-xyz.md")), null);
});

for (const [status, closed] of [
  ["accepted", true],
  ["Accepted", true],
  ["ACCEPTED", true],
  ["done", true],
  ["dropped", true],
  ["accept", false],
  ["accepted-ish", false],
  ["not accepted", false],
  ["", false],
  ["in-review", false],
]) {
  test(`isClosedStatus: ${JSON.stringify(status)} → ${closed}`, () => {
    assert.equal(isClosedStatus(status), closed);
  });
}

test("findNonDoneTasks: `accepted` and `**accepted**` rows are closed, never named as open work", () => {
  const { file, dir } = tmpFile(
    [
      "| # | Task | Status |",
      "|---|---|---|",
      "| 001 | Plain | accepted |",
      "| 002 | Bold | **accepted** |",
      "| 003 | Near miss | accept |",
      "| 004 | Suffix | accepted-ish |",
    ].join("\n"),
  );
  try {
    assert.deepEqual(findNonDoneTasks(file).map((r) => r.id), ["003", "004"]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

const PENDING_HEADER = ["| ID | Kind | Task | What | Who | Closing evidence | Status |", "|---|---|---|---|---|---|---|"];

function pendingRow(n, status, kind = "risk") {
  return `| P${n} | ${kind} | 0${n} | item ${n} | owner | evidence ${n} | ${status} |`;
}

function withPending(lines, check) {
  const dir = mkdtempSync(join(tmpdir(), "ccf-pending-test-"));
  const file = join(dir, "PENDING.md");
  writeFileSync(file, lines.join("\n"), "utf8");
  try {
    check(file);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("findOpenPendingItems: missing file → []", () => {
  assert.deepEqual(findOpenPendingItems(join(tmpdir(), "ccf-no-such-dir", "PENDING.md")), []);
});

test("findOpenPendingItems: a directory in place of the file → []", () => {
  const dir = mkdtempSync(join(tmpdir(), "ccf-pending-dir-"));
  try {
    assert.deepEqual(findOpenPendingItems(dir), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("findOpenPendingItems: header only, empty table → []", () => {
  withPending(PENDING_HEADER, (file) => assert.deepEqual(findOpenPendingItems(file), []));
});

test("findOpenPendingItems: only closed rows → []", () => {
  withPending([...PENDING_HEADER, pendingRow(1, "closed"), pendingRow(2, "closed", "action")], (file) =>
    assert.deepEqual(findOpenPendingItems(file), []),
  );
});

test("findOpenPendingItems: returns the fields of one open row", () => {
  withPending([...PENDING_HEADER, pendingRow(1, "closed"), pendingRow(2, "open", "action")], (file) =>
    assert.deepEqual(findOpenPendingItems(file), [{ id: "P2", kind: "action", task: "02", what: "item 2", who: "owner" }]),
  );
});

for (const count of [0, 1, 5, 6]) {
  test(`findOpenPendingItems: ${count} open rows → ${count} items, in file order`, () => {
    const rows = Array.from({ length: count }, (_, i) => pendingRow(i + 1, "open"));
    withPending([...PENDING_HEADER, ...rows, pendingRow(9, "closed")], (file) =>
      assert.deepEqual(
        findOpenPendingItems(file).map((r) => r.id),
        rows.map((_, i) => `P${i + 1}`),
      ),
    );
  });
}

test("findOpenPendingItems: the Status column is found by header, not by position", () => {
  withPending(
    [
      "| Status | ID | Kind | Task | What | Who | Closing evidence |",
      "|---|---|---|---|---|---|---|",
      "| open | P1 | risk | 038 | payload | owner | closed |",
      "| closed | P2 | risk | 039 | agent_type | owner | open |",
    ],
    (file) => assert.deepEqual(findOpenPendingItems(file), [{ id: "P1", kind: "risk", task: "038", what: "payload", who: "owner" }]),
  );
});

test("findOpenPendingItems: status match is case-insensitive and ignores emphasis, but is anchored", () => {
  withPending(
    [...PENDING_HEADER, pendingRow(1, "Open"), pendingRow(2, "**open**"), pendingRow(3, "reopened"), pendingRow(4, "open-ish")],
    (file) => assert.deepEqual(findOpenPendingItems(file).map((r) => r.id), ["P1", "P2"]),
  );
});

test("findOpenPendingItems: a row inside a fenced block is ignored", () => {
  withPending(
    ["```", ...PENDING_HEADER, pendingRow(1, "open"), "```", "", ...PENDING_HEADER, pendingRow(2, "open")],
    (file) => assert.deepEqual(findOpenPendingItems(file).map((r) => r.id), ["P2"]),
  );
});

test("findOpenPendingItems: a table with no Status header is not read", () => {
  withPending(["| ID | Kind | What |", "|---|---|---|", "| P1 | risk | open |"], (file) =>
    assert.deepEqual(findOpenPendingItems(file), []),
  );
});

test("findOpenPendingItems: ragged rows and an unclosed fence never throw", () => {
  withPending([...PENDING_HEADER, "| P1 | risk |", "|||", "```", pendingRow(2, "open")], (file) =>
    assert.deepEqual(findOpenPendingItems(file), []),
  );
});

function pendingItem(n) {
  return { id: `P${n}`, kind: "risk", task: `0${n}`, what: `item ${n}`, who: "owner" };
}

test("buildPendingReminder: no items → empty string", () => {
  assert.equal(buildPendingReminder([]), "");
});

test("buildPendingReminder: 1 item names its id, kind, task, what and who, with no 'more' tail", () => {
  const text = buildPendingReminder([pendingItem(1)]);
  for (const part of ["P1", "risk", "01", "item 1", "owner", ".claude/plan/PENDING.md"]) assert.ok(text.includes(part), part);
  assert.ok(!/more in/.test(text));
});

test("buildPendingReminder: 5 items → all 5 listed, no 'more' tail", () => {
  const text = buildPendingReminder([1, 2, 3, 4, 5].map(pendingItem));
  for (const n of [1, 2, 3, 4, 5]) assert.ok(text.includes(`item ${n}`));
  assert.ok(!/more in/.test(text));
});

test("buildPendingReminder: 6 items → first 5 listed, then 'and 1 more in .claude/plan/PENDING.md'", () => {
  const text = buildPendingReminder([1, 2, 3, 4, 5, 6].map(pendingItem));
  assert.ok(text.includes("item 5"));
  assert.ok(!text.includes("item 6"));
  assert.ok(text.includes("and 1 more in .claude/plan/PENDING.md"));
});

test("buildPendingReminder: huge cells stay far under the 10,000-character additionalContext cap", () => {
  const big = "x".repeat(50000);
  const items = Array.from({ length: 40 }, () => ({ id: big, kind: big, task: big, what: big, who: big }));
  const text = buildPendingReminder(items);
  assert.ok(text.length < 8000, `length ${text.length}`);
  assert.ok(text.includes("and 35 more in .claude/plan/PENDING.md"));
});
