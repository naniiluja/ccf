// Process-level tests for scripts/jev-slice-check.mjs, against a local node:http fake of the System One API
// (the URL is overridden with CCF_JEV_URL). Lives in hooks/lib so the standard
// `node --test plugins/ccf/hooks/lib/*.test.mjs` run covers it. The script is spawned ASYNC: a sync
// spawn would block this process's event loop and the fake server could never answer.

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "scripts", "jev-slice-check.mjs");
const KEY = "slice-key-DO-NOT-LEAK-9876";

/** @type {string[]} */
const dirs = [];
test.after(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

/** @param {string[]} rows PLAN rows as [id, status] */
function makeProject(rows, taskFiles = {}) {
  const dir = mkdtempSync(join(tmpdir(), "ccf-slice-test-"));
  dirs.push(dir);
  mkdirSync(join(dir, ".claude", "plan"), { recursive: true });
  writeFileSync(join(dir, ".claude", "plan", "PLAN.md"),
    "| # | Task | Layers | Gate | Predecessor | Status |\n|---|---|---|---|---|---|\n" +
      rows.map(([id, status]) => `| ${id} | Task ${id} | x | g | — | ${status} |`).join("\n") + "\n");
  for (const [id, files] of Object.entries(taskFiles)) {
    writeFileSync(join(dir, ".claude", "plan", `task-${id}-x.md`),
      `# Task ${id}\n\n## Acceptance criteria\n- [ ] crit ${id}\n\n## Files to touch\n${files}\n`);
  }
  return dir;
}

/** @param {"graph"|"429"} mode */
async function startFake(mode) {
  /** @type {any[]} */
  const requests = [];
  const sockets = new Set();
  const server = createServer((req, res) => {
    let raw = "";
    req.on("data", (d) => (raw += d));
    req.on("end", () => {
      const body = JSON.parse(raw || "{}");
      requests.push({ auth: req.headers.authorization, body });
      if (mode === "429") { res.statusCode = 429; return res.end("{}"); }
      /** @type {Record<string, any>} */
      const answers = {};
      for (const id of Object.keys(body.questions ?? {})) {
        answers[id] = { noul: id === "dep_1_2" || id === "fragment_2" ? 0.9 : 0.1 };
      }
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ model: "jev-latest", answers, usage: {} }));
    });
  });
  server.on("connection", (s) => { sockets.add(s); s.on("close", () => sockets.delete(s)); });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${/** @type {any} */ (server.address()).port}`;
  return { url, requests, close: () => new Promise((r) => { for (const s of sockets) s.destroy(); server.close(() => r(undefined)); }) };
}

/** @returns {Promise<{ stdout: string, stderr: string, status: number | null }>} */
function run(dir, env) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [SCRIPT, "--dir", dir], { env: { ...process.env, TYPESAFE_API_KEY: "", ...env }, shell: false });
    let stdout = "", stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("close", (status) => resolve({ stdout, stderr, status }));
  });
}

const THREE = [["1", "todo"], ["2", "todo"], ["3", "todo"]];
const THREE_FILES = { 1: "a.mjs", 2: "a.mjs, b.mjs", 3: "c.mjs" };

test("jev-slice-check: overlap edge from code, dependency + fragment from Jev, waves, key never printed", async () => {
  const fake = await startFake("graph");
  try {
    const r = await run(makeProject(THREE, THREE_FILES), { TYPESAFE_API_KEY: KEY, CCF_JEV_URL: fake.url });
    assert.equal(r.status, 0);
    assert.ok(!r.stdout.includes(KEY) && !r.stderr.includes(KEY));
    const out = JSON.parse(r.stdout);
    assert.equal(out.ok, true);
    assert.deepEqual(out.edges.map((e) => `${e.from}>${e.to}:${e.kind}`).sort(), ["1>2:file-overlap", "2>3:dependency"]);
    assert.deepEqual(out.fragments.map((f) => f.id), ["3"]);
    assert.deepEqual(out.waves, [["1"], ["2"], ["3"]]);
    assert.deepEqual(out.skipped, []);
    assert.deepEqual(out.unanswered, []);
    assert.match(out.note, /backtest/);
    // wire check: bearer auth, tasks[i] paths, and the overlapping pair was never asked
    assert.equal(fake.requests[0].auth, `Bearer ${KEY}`);
    const qs = Object.keys(fake.requests[0].body.questions);
    assert.ok(!qs.includes("dep_0_1") && !qs.includes("contract_0_1") && !qs.includes("shared_state_0_1"));
    assert.ok(qs.includes("shared_state_1_2"));
    assert.ok(fake.requests[0].body.questions.dep_1_2.instructions.includes("tasks[1]"));
  } finally {
    await fake.close();
  }
});

test("jev-slice-check: closed tasks are not sent (only open rows are planned)", async () => {
  const fake = await startFake("graph");
  try {
    const r = await run(makeProject([["1", "done"], ["2", "todo"], ["3", "todo"]], THREE_FILES), { TYPESAFE_API_KEY: KEY, CCF_JEV_URL: fake.url });
    const out = JSON.parse(r.stdout);
    assert.equal(out.tasks, 2);
    assert.deepEqual(fake.requests[0].body.state.tasks.map((t) => t.id), ["2", "3"]);
  } finally {
    await fake.close();
  }
});

test("jev-slice-check: API failure → still exit 0, batch reported as skipped, code-computed overlap survives", async () => {
  const fake = await startFake("429");
  try {
    const r = await run(makeProject(THREE, THREE_FILES), { TYPESAFE_API_KEY: KEY, CCF_JEV_URL: fake.url });
    assert.equal(r.status, 0);
    const out = JSON.parse(r.stdout);
    assert.equal(out.ok, true);
    assert.deepEqual(out.skipped, [{ batch: 0, reason: "rate-limited" }]);
    // fail-closed: the pairs Jev never answered are dependencies, so nothing runs in parallel
    assert.deepEqual(out.edges.map((e) => `${e.from}>${e.to}:${e.kind}`), ["1>2:file-overlap", "1>3:unanswered", "2>3:unanswered"]);
    assert.deepEqual(out.waves, [["1"], ["2"], ["3"]]);
    assert.deepEqual(out.parallel_candidates, []);
  } finally {
    await fake.close();
  }
});

test("jev-slice-check: no key / no plan / fewer than 2 open tasks → exit 0 with a stated reason, no network call", async () => {
  const fake = await startFake("graph");
  try {
    const cases = [
      [makeProject(THREE, THREE_FILES), { CCF_JEV_URL: fake.url }, "no-key"],
      [mkdtempSync(join(tmpdir(), "ccf-slice-empty-")), { TYPESAFE_API_KEY: KEY, CCF_JEV_URL: fake.url }, "no-plan"],
      [makeProject([["1", "todo"], ["2", "done"]], { 1: "a.mjs" }), { TYPESAFE_API_KEY: KEY, CCF_JEV_URL: fake.url }, "not-enough-tasks"],
    ];
    for (const [dir, env, reason] of cases) {
      dirs.push(dir);
      const r = await run(dir, env);
      assert.equal(r.status, 0, reason);
      assert.equal(JSON.parse(r.stdout).reason, reason);
    }
    assert.equal(fake.requests.length, 0);
  } finally {
    await fake.close();
  }
});
