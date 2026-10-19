import { test } from "node:test";
import assert from "node:assert/strict";
import { lintPlan } from "./plan-lint.mjs";

const T = (id, extra = {}) => ({
  id, title: `task ${id}`, taskFile: `task-${id}-x.md`, files: [`src/${id}.js`], criteria: [`${id} works`], dependsOn: [], ...extra,
});
const kinds = (r) => r.findings.map((f) => f.kind).sort();

test("lintPlan: independent, complete tasks give no finding and one wave", () => {
  const r = lintPlan({ tasks: [T("1"), T("2"), T("3")], knownIds: ["1", "2", "3"] });
  assert.deepEqual(r.findings, []);
  assert.equal(r.waveCount, 1);
  assert.equal(r.serial, false);
});

test("lintPlan: three tasks that each carry README.md collide on shared-spec and serialise into three waves", () => {
  const tasks = ["1", "2", "3"].map((id) => T(id, { files: [`src/${id}.js`, "README.md"] }));
  const r = lintPlan({ tasks, knownIds: ["1", "2", "3"] });
  assert.deepEqual(kinds(r), ["hotspot-collision"]);
  assert.equal(r.findings[0].hotspot, "shared-spec");
  assert.deepEqual(r.findings[0].tasks, ["1", "2", "3"]);
  assert.equal(r.waveCount, 3);
  assert.equal(r.serial, true);
  assert.match(r.findings[0].advice, /one final task/);
});

test("lintPlan: different shared-spec files still collide, because the hotspot is the class", () => {
  const r = lintPlan({ tasks: [T("1", { files: ["CLAUDE.md"] }), T("2", { files: [".claude/rules/tooling.md"] })], knownIds: ["1", "2"] });
  assert.deepEqual(kinds(r), ["hotspot-collision"]);
});

test("lintPlan: a final sync task that depends on the others is the intended shape, not a collision", () => {
  const tasks = [T("1"), T("2"), T("3", { files: ["README.md", "CHANGELOG.md"], dependsOn: ["1", "2"] })];
  const r = lintPlan({ tasks, knownIds: ["1", "2", "3"] });
  assert.deepEqual(r.findings, []);
  assert.equal(r.waveCount, 2);
});

test("lintPlan: two tasks on one hotspot are fine when a declared dependency already orders them", () => {
  const tasks = [T("1", { files: ["README.md"] }), T("2", { files: ["README.md"], dependsOn: ["1"] })];
  assert.deepEqual(lintPlan({ tasks, knownIds: ["1", "2"] }).findings, []);
});

test("lintPlan: no files, no criteria, no task file are findings per task", () => {
  const r = lintPlan({ tasks: [T("1", { files: [] }), T("2", { criteria: [] }), T("3", { taskFile: null })], knownIds: ["1", "2", "3"] });
  assert.deepEqual(r.findings.map((f) => `${f.kind}:${f.id}`).sort(), ["no-criteria:2", "no-files:1", "no-task-file:3"]);
});

test("lintPlan: a Depends on id that is no known task is unknown-dependency; a known closed task is fine", () => {
  const r = lintPlan({ tasks: [T("1", { dependsOn: ["999", "50"] })], knownIds: ["1", "50"] });
  assert.deepEqual(r.findings.map((f) => `${f.kind}:${f.id}:${f.dependsOn}`), ["unknown-dependency:1:999"]);
});

test("lintPlan: a dependency cycle among open tasks is reported once", () => {
  const r = lintPlan({ tasks: [T("1", { dependsOn: ["2"] }), T("2", { dependsOn: ["1"] })], knownIds: ["1", "2"] });
  assert.deepEqual(kinds(r), ["dependency-cycle"]);
  assert.deepEqual(r.findings[0].tasks, ["1", "2"]);
});

test("lintPlan: garbage input never throws", () => {
  for (const g of [undefined, null, 5, {}, { tasks: "x" }, { tasks: [null, 5, {}] }]) {
    const r = lintPlan(g);
    assert.ok(Array.isArray(r.findings));
  }
});
