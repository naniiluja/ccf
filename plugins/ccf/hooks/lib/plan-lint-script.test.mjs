import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "scripts", "plan-lint.mjs");
const dirs = [];
test.after(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

function project(tasks) {
  const dir = mkdtempSync(join(tmpdir(), "ccf-lint-"));
  dirs.push(dir);
  const plan = join(dir, ".claude", "plan");
  mkdirSync(join(plan, "archive"), { recursive: true });
  const rows = tasks.map((t) => `| ${t.id} | ${t.id} slice | ${t.status ?? "todo"} |`).join("\n");
  writeFileSync(join(plan, "PLAN.md"), `## Origin: x\n\n| # | Slice | Status |\n|---|---|---|\n${rows}\n`);
  for (const t of tasks) {
    writeFileSync(join(plan, `task-${t.id}-x.md`), `# ${t.id}\n\n- **Depends on:** ${t.dependsOn ?? "—"}\n\n## Acceptance criteria\n${t.criteria ?? "- [ ] works"}\n\n## Files to touch\n${(t.files ?? [`src/${t.id}.js`]).map((f) => `- ${f}`).join("\n")}\n`);
  }
  writeFileSync(join(plan, "archive", "task-050-old.md"), "# 50\n");
  return dir;
}

function run(dir, extra = []) {
  const r = spawnSync(process.execPath, [SCRIPT, "--dir", dir, ...extra], { encoding: "utf8", shell: false });
  return { status: r.status, out: JSON.parse(r.stdout || "{}") };
}

test("plan-lint script: serial backlog on README.md is reported, nothing is written, exit 0", () => {
  const dir = project([1, 2, 3].map((n) => ({ id: String(n), files: [`src/${n}.js`, "README.md"] })));
  const before = readdirSync(join(dir, ".claude", "plan")).join();
  const r = run(dir);
  assert.equal(r.status, 0);
  assert.equal(r.out.ok, true);
  assert.deepEqual(r.out.findings.map((f) => f.kind), ["hotspot-collision"]);
  assert.equal(r.out.waveCount, 3);
  assert.equal(r.out.serial, true);
  assert.equal(readdirSync(join(dir, ".claude", "plan")).join(), before);
});

test("plan-lint script: a clean plan, a closed task, an archived predecessor and --tasks all behave", () => {
  const dir = project([{ id: "1" }, { id: "2", dependsOn: "050" }, { id: "9", status: "done", files: ["README.md"] }]);
  const r = run(dir);
  assert.deepEqual(r.out.findings, []);
  assert.equal(r.out.tasks, 2);
  assert.equal(run(dir, ["--tasks", "1"]).out.tasks, 1);
});

test("plan-lint script: no plan and no open tasks are reasons, never failures", () => {
  const empty = mkdtempSync(join(tmpdir(), "ccf-lint-"));
  dirs.push(empty);
  const none = run(empty);
  assert.equal(none.status, 0);
  assert.deepEqual(none.out, { ok: false, reason: "no-plan" });
  assert.deepEqual(run(project([{ id: "1", status: "done" }])).out, { ok: false, reason: "no-open-tasks" });
});
