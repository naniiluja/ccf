import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "scripts", "plan-waves.mjs");
const KEY = "inline-key-DO-NOT-LEAK-8765";

const dirs = [];
test.after(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

const TASK = (id, files, ui = "no") =>
  `# Task ${id}\n\n- **Depends on:** —\n- **Touches UI:** ${ui}\n\n## Goal (one sentence)\nDo ${id}.\n\n## Acceptance criteria\n- [ ] works\n\n## Files to touch\n${files.map((f) => `- ${f}`).join("\n")}\n`;

function makeProject() {
  const dir = mkdtempSync(join(tmpdir(), "ccf-inline-"));
  dirs.push(dir);
  const files = {
    ".claude/plan/PLAN.md": "## Origin: Inline Test\n\n| # | Slice | Status |\n|---|---|---|\n| 101 | a | todo |\n| 102 | b | todo |\n| 103 | c | todo |\n",
    ".claude/plan/task-101-a.md": TASK("101", ["src/a.js"]),
    ".claude/plan/task-102-b.md": TASK("102", ["src/b.js"]),
    ".claude/plan/task-103-c.md": TASK("103", ["src/c.js"], "yes"),
    "src/a.js": "one\ntwo\nthree\n",
  };
  for (const [p, body] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, p)), { recursive: true });
    writeFileSync(join(dir, p), body);
  }
  return dir;
}

async function startFake(mode) {
  const requests = [];
  const sockets = new Set();
  const server = createServer((req, res) => {
    let raw = "";
    req.on("data", (d) => (raw += d));
    req.on("end", () => {
      requests.push({ auth: req.headers.authorization, body: JSON.parse(raw || "{}") });
      if (mode === "429") { res.statusCode = 429; return res.end("{}"); }
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ model: "jev-latest", answers: { "101::small": { noul: 0.92 }, "102::small": { noul: 0.15 } }, usage: {} }));
    });
  });
  server.on("connection", (s) => { sockets.add(s); s.on("close", () => sockets.delete(s)); });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${server.address().port}`;
  return { url, requests, close: () => new Promise((r) => { for (const s of sockets) s.destroy(); server.close(() => r(undefined)); }) };
}

function run(dir, env, extra = ["--inline"]) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [SCRIPT, "--dir", dir, ...extra], { env: { ...process.env, TYPESAFE_API_KEY: "", ...env }, shell: false });
    let stdout = "", stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("close", (status) => resolve({ status, stdout, stderr, out: JSON.parse(stdout || "{}") }));
  });
}

const modesOf = (out) => Object.fromEntries(out.waves.flat().map((t) => [t.id, [t.mode, t.modeReason]]));

test("plan-waves --inline: Jev small → inline, large → worktree, a UI task is never asked; the key is never printed", async () => {
  const fake = await startFake("ok");
  try {
    const r = await run(makeProject(), { TYPESAFE_API_KEY: KEY, CCF_JEV_URL: fake.url });
    assert.equal(r.status, 0);
    assert.equal(r.out.inline, "ok");
    assert.deepEqual(modesOf(r.out), { 101: ["inline", "jev-small"], 102: ["worktree", "jev-large"], 103: ["worktree", "touches-ui"] });
    assert.equal(r.out.waves.flat().find((t) => t.id === "101").inlineScore, 0.92);
    assert.equal(fake.requests.length, 1);
    assert.equal(fake.requests[0].auth, `Bearer ${KEY}`);
    assert.deepEqual(Object.keys(fake.requests[0].body.questions).sort(), ["101::small", "102::small"]);
    assert.deepEqual(fake.requests[0].body.state.tasks[0].files, [{ path: "src/a.js", existingLines: 3 }]);
    assert.ok(!r.stdout.includes(KEY) && !r.stderr.includes(KEY));
  } finally {
    await fake.close();
  }
});

test("plan-waves --inline: a failing Jev API → every task keeps its worktree, exit 0", async () => {
  const fake = await startFake("429");
  try {
    const r = await run(makeProject(), { TYPESAFE_API_KEY: KEY, CCF_JEV_URL: fake.url });
    assert.equal(r.status, 0);
    assert.equal(r.out.inline, "rate-limited");
    assert.deepEqual(modesOf(r.out), { 101: ["worktree", "rate-limited"], 102: ["worktree", "rate-limited"], 103: ["worktree", "touches-ui"] });
  } finally {
    await fake.close();
  }
});

test("plan-waves --inline: an unreachable Jev → worktree; no key or no flag → worktree without any request", async () => {
  const fake = await startFake("ok");
  try {
    const dead = await run(makeProject(), { TYPESAFE_API_KEY: KEY, CCF_JEV_URL: "http://127.0.0.1:1" });
    assert.equal(dead.out.inline, "network");
    assert.ok(dead.out.waves.flat().every((t) => t.mode === "worktree"));
    const noKey = await run(makeProject(), { CCF_JEV_URL: fake.url });
    assert.equal(noKey.out.inline, "no-key");
    assert.ok(noKey.out.waves.flat().every((t) => t.mode === "worktree"));
    const off = await run(makeProject(), { TYPESAFE_API_KEY: KEY, CCF_JEV_URL: fake.url }, []);
    assert.equal(off.out.inline, "not-asked");
    assert.ok(off.out.waves.flat().every((t) => t.mode === "worktree" && t.modeReason !== "jev-small"));
    assert.equal(fake.requests.length, 0);
  } finally {
    await fake.close();
  }
});
