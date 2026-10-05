import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readSnapshot } from "./ui-snapshot.mjs";

const PLAN = [
  "# Plan",
  "## Origin: demo",
  "| # | Slice | Status | Depends on |",
  "|---|-------|--------|-----------|",
  "| 001 | first | **done** | — |",
  "| 002 | second | in-review | 001 |",
  "| 003 | third | todo | 002 |",
  "| 004 | fourth | accepted | — |",
  "",
].join("\n");

const PENDING = [
  "| ID | Kind | Task | What | Who | Closing evidence | Status |",
  "|---|---|---|---|---|---|---|",
  "| R1 | risk | 001 | a | owner | x | open |",
  "| R2 | risk | 002 | b | owner | x | closed |",
  "| A1 | action | 002 | c | owner | x | open |",
  "",
].join("\n");

function project(withPending = true) {
  const dir = mkdtempSync(join(tmpdir(), "ccf-ui-snapshot-"));
  mkdirSync(join(dir, ".claude", "plan"), { recursive: true });
  writeFileSync(join(dir, ".claude", "plan", "PLAN.md"), PLAN);
  if (withPending) writeFileSync(join(dir, ".claude", "plan", "PENDING.md"), PENDING);
  return dir;
}

test("readSnapshot lists every task with its column, the active task and open risks", () => {
  const snapshot = readSnapshot(project());
  assert.equal(snapshot.ok, true);
  assert.deepEqual(snapshot.tasks.map((t) => `${t.id}:${t.column}`), ["001:done", "002:in-review", "003:todo", "004:done"]);
  assert.deepEqual(snapshot.active, { id: "002", title: "second", status: "in-review", column: "in-review" });
  assert.equal(snapshot.openRisks, 1);
  assert.equal(typeof snapshot.specStale, "boolean");
});

test("readSnapshot reports no-plan without PLAN.md and zero risks without PENDING.md", () => {
  assert.deepEqual(readSnapshot(mkdtempSync(join(tmpdir(), "ccf-ui-empty-"))), { ok: false, reason: "no-plan" });
  assert.equal(readSnapshot(project(false)).openRisks, 0);
});

test("the CLI prints the snapshot as JSON and exits 0", () => {
  const cli = fileURLToPath(new URL("./ui-snapshot.mjs", import.meta.url));
  const ran = spawnSync(process.execPath, [cli, "--dir", project()], { encoding: "utf8" });
  assert.equal(ran.status, 0);
  assert.equal(JSON.parse(ran.stdout).active.id, "002");
  const empty = spawnSync(process.execPath, [cli, "--dir", join(tmpdir(), "ccf-ui-missing-dir")], { encoding: "utf8" });
  assert.equal(empty.status, 0);
  assert.equal(JSON.parse(empty.stdout).ok, false);
});
