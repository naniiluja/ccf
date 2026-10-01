// Process-level tests for scripts/memory-audit.mjs against throwaway memory dirs and a node:http fake of
// the System One API on 127.0.0.1 (CCF_JEV_URL). The real API is never called, and the child env always
// overrides TYPESAFE_API_KEY so a real key in this shell cannot reach a test. Spawned ASYNC: a sync spawn
// would block the event loop and the fake could never answer.
// Covers the dir EP {present, missing, no arg}, the gate on a 21-feedback fixture, read-only-ness, and the
// Jev decision table: --jev × key × gate × payload size × API outcome, with precedence
// off → no-key → gate-closed → nothing-to-ask / too-large → API reason.

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdirSync, mkdtempSync, writeFileSync, rmSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "scripts", "memory-audit.mjs");
const KEY = "memory-key-DO-NOT-LEAK-9876";

/** @type {string[]} */
const dirs = [];
test.after(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

/** @param {string} type @param {string} name @param {string} [body] */
function mem(type, name, body = "body") {
  return `---\nname: ${name}\ndescription: d\nmetadata:\n  type: ${type}\n---\n${body}\n`;
}

/**
 * A memory dir with `feedback` feedback files plus one user file, all indexed.
 * @param {number} feedback
 * @param {{ bigBody?: number, indexExtraLines?: number }} [opts]
 */
function makeMemoryDir(feedback, opts = {}) {
  const dir = mkdtempSync(join(tmpdir(), "ccf-memory-test-"));
  dirs.push(dir);
  const index = [];
  for (let i = 0; i < feedback; i++) {
    const f = `fb-${i}.md`;
    writeFileSync(join(dir, f), mem("feedback", `fb-${i}`, i === 0 && opts.bigBody ? "a".repeat(opts.bigBody) : `fb body ${i}`));
    index.push(`- [FB ${i}](${f}) — h`);
  }
  writeFileSync(join(dir, "pref.md"), mem("user", "pref", "user secret preference"));
  index.push("- [Pref](pref.md) — h");
  for (let i = 0; i < (opts.indexExtraLines ?? 0); i++) index.push(`<!-- filler ${i} -->`);
  writeFileSync(join(dir, "MEMORY.md"), index.join("\n") + "\n");
  return dir;
}

/** @param {string} dir */
function snapshot(dir) {
  return readdirSync(dir).sort().map((f) => {
    const s = statSync(join(dir, f));
    return `${f}:${s.size}:${s.mtimeMs}`;
  });
}

/**
 * @param {"ok"|"401"|"429"|"500"|"badjson"|"hang"|"partial"} mode
 */
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
      if (mode === "hang") return;
      if (mode === "401" || mode === "429" || mode === "500") { res.statusCode = Number(mode); return res.end("{}"); }
      res.setHeader("content-type", "application/json");
      if (mode === "badjson") return res.end("{not json");
      /** @type {Record<string, any>} */
      const answers = {};
      for (const k of Object.keys(body.questions ?? {})) {
        if (mode === "partial" && k === "pref.md::merge") continue;
        answers[k] = { noul: k.endsWith("::drop") ? 0.82 : k.endsWith("::keep") ? 0.3 : 0.1 };
      }
      res.end(JSON.stringify({ model: "jev-latest", answers, usage: {} }));
    });
  });
  server.on("connection", (s) => { sockets.add(s); s.on("close", () => sockets.delete(s)); });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${/** @type {any} */ (server.address()).port}`;
  return { url, requests, close: () => new Promise((r) => { for (const s of sockets) s.destroy(); server.close(() => r(undefined)); }) };
}

/**
 * @param {string[]} args @param {Record<string, string>} [env]
 * @returns {Promise<{ stdout: string, stderr: string, status: number | null, out: any }>}
 */
function run(args, env = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [SCRIPT, ...args], { env: { ...process.env, TYPESAFE_API_KEY: "", CCF_JEV_URL: "http://127.0.0.1:9", ...env }, shell: false });
    let stdout = "", stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("close", (status) => {
      let out = null;
      try { out = JSON.parse(stdout); } catch { /* asserted by the caller */ }
      resolve({ stdout, stderr, status, out });
    });
  });
}

/** Strip the Jev-specific parts so fallbacks can be compared to the plain audit. @param {any} out */
function plain(out) {
  const { jev, ...rest } = out;
  return { ...rest, files: rest.files.map((/** @type {any} */ f) => { const { jev: _j, ...g } = f; return g; }) };
}

// ---- dir EP ----

test("memory-audit: no --memory-dir → no-memory-dir-arg, exit 0", async () => {
  const r = await run([]);
  assert.equal(r.status, 0);
  assert.deepEqual(r.out, { gate: false, reason: "no-memory-dir-arg" });
});

test("memory-audit: missing dir → no-memory-dir, exit 0", async () => {
  const r = await run(["--memory-dir", join(tmpdir(), "ccf-does-not-exist-071")]);
  assert.equal(r.status, 0);
  assert.deepEqual(r.out, { gate: false, reason: "no-memory-dir" });
});

test("memory-audit: empty dir → gate false, zero counts", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ccf-memory-test-"));
  dirs.push(dir);
  const r = await run(["--memory-dir", dir]);
  assert.equal(r.out.gate, false);
  assert.equal(r.out.counts.feedback, 0);
  assert.deepEqual(r.out.files, []);
  assert.equal(r.out.jev, "off");
});

test("memory-audit: 20 feedback closed, 21 feedback opens with reasons [feedback-count]; read-only", async () => {
  const d20 = makeMemoryDir(20);
  assert.equal((await run(["--memory-dir", d20])).out.gate, false);
  const d21 = makeMemoryDir(21);
  const before = snapshot(d21);
  const r = await run(["--memory-dir", d21]);
  assert.equal(r.status, 0);
  assert.equal(r.out.gate, true);
  assert.deepEqual(r.out.reasons, ["feedback-count"]);
  assert.equal(r.out.counts.feedback, 21);
  assert.equal(r.out.counts.user, 1);
  assert.equal(r.out.files.length, 22);
  assert.ok(!r.out.files.some((/** @type {any} */ f) => f.file === "MEMORY.md"));
  assert.deepEqual(r.out.danglingIndex, []);
  assert.deepEqual(r.out.unindexed, []);
  assert.deepEqual(snapshot(d21), before);
});

test("memory-audit: subdirectories and non-.md files are ignored; thresholds are flags", async () => {
  const dir = makeMemoryDir(3);
  writeFileSync(join(dir, "notes.txt"), "x");
  mkdirSync(join(dir, "sub"));
  writeFileSync(join(dir, "sub", "nested.md"), mem("feedback", "nested"));
  const r = await run(["--memory-dir", dir, "--max-feedback", "2"]);
  assert.equal(r.out.files.length, 4);
  assert.deepEqual(r.out.reasons, ["feedback-count"]);
  const r2 = await run(["--memory-dir", dir, "--index-lines", "4"]);
  assert.deepEqual(r2.out.reasons, ["index-lines"]);
});

// ---- Jev decision table ----

test("jev ok: every file labelled with its highest score, state carries texts + index, key never printed", async () => {
  const fake = await startFake("ok");
  try {
    const dir = makeMemoryDir(21);
    const before = snapshot(dir);
    const r = await run(["--memory-dir", dir, "--jev"], { TYPESAFE_API_KEY: KEY, CCF_JEV_URL: fake.url });
    assert.equal(r.status, 0);
    assert.ok(!r.stdout.includes(KEY) && !r.stderr.includes(KEY));
    assert.equal(r.out.jev, "ok");
    assert.ok(r.out.files.every((/** @type {any} */ f) => f.jev && f.jev.label === "drop" && f.jev.score === 0.82));
    assert.equal(fake.requests.length, 1);
    assert.equal(fake.requests[0].auth, `Bearer ${KEY}`);
    const state = fake.requests[0].body.state;
    assert.match(state.index, /\(pref\.md\)/);
    const pref = state.memories.find((/** @type {any} */ m) => m.file === "pref.md");
    assert.match(pref.text, /user secret preference/);
    assert.match(pref.text, /^---\nname: pref/);
    assert.equal(Object.keys(fake.requests[0].body.questions).length, 22 * 3);
    assert.deepEqual(snapshot(dir), before);
  } finally {
    await fake.close();
  }
});

test("jev partial answers: the incomplete file gets no entry, the others do", async () => {
  const fake = await startFake("partial");
  try {
    const r = await run(["--memory-dir", makeMemoryDir(21), "--jev"], { TYPESAFE_API_KEY: KEY, CCF_JEV_URL: fake.url });
    assert.equal(r.out.jev, "ok");
    const pref = r.out.files.find((/** @type {any} */ f) => f.file === "pref.md");
    assert.equal(pref.jev, undefined);
    assert.equal(r.out.files.filter((/** @type {any} */ f) => f.jev).length, 21);
  } finally {
    await fake.close();
  }
});

/**
 * Run the fallback row and assert: exit 0, the expected status, no jev entries, same audit as without Jev.
 * @param {string} dir @param {string[]} args @param {Record<string,string>} env @param {string} status
 */
async function assertFallback(dir, args, env, status) {
  const base = await run(["--memory-dir", dir]);
  const r = await run(["--memory-dir", dir, ...args], env);
  assert.equal(r.status, 0);
  assert.ok(!r.stdout.includes(KEY) && !r.stderr.includes(KEY));
  assert.equal(r.out.jev, status);
  assert.ok(r.out.files.every((/** @type {any} */ f) => f.jev === undefined));
  assert.deepEqual(plain(r.out), plain(base.out));
}

test("jev fallback: no --jev → off, zero requests (even with key and open gate)", async () => {
  const fake = await startFake("ok");
  try {
    await assertFallback(makeMemoryDir(21), [], { TYPESAFE_API_KEY: KEY, CCF_JEV_URL: fake.url }, "off");
    assert.equal(fake.requests.length, 0);
  } finally { await fake.close(); }
});

test("jev fallback: --jev without key → no-key, zero requests", async () => {
  const fake = await startFake("ok");
  try {
    await assertFallback(makeMemoryDir(21), ["--jev"], { CCF_JEV_URL: fake.url }, "no-key");
    assert.equal(fake.requests.length, 0);
  } finally { await fake.close(); }
});

test("jev fallback: gate closed → gate-closed, zero requests", async () => {
  const fake = await startFake("ok");
  try {
    await assertFallback(makeMemoryDir(20), ["--jev"], { TYPESAFE_API_KEY: KEY, CCF_JEV_URL: fake.url }, "gate-closed");
    assert.equal(fake.requests.length, 0);
  } finally { await fake.close(); }
});

test("jev fallback: open index gate with zero memory files → nothing-to-ask, zero requests", async () => {
  const fake = await startFake("ok");
  try {
    const dir = mkdtempSync(join(tmpdir(), "ccf-memory-test-"));
    dirs.push(dir);
    writeFileSync(join(dir, "MEMORY.md"), "x\n".repeat(150));
    await assertFallback(dir, ["--jev"], { TYPESAFE_API_KEY: KEY, CCF_JEV_URL: fake.url }, "nothing-to-ask");
    assert.equal(fake.requests.length, 0);
  } finally { await fake.close(); }
});

test("jev fallback: state over 80KB → too-large, zero requests, nothing truncated", async () => {
  const fake = await startFake("ok");
  try {
    await assertFallback(makeMemoryDir(21, { bigBody: 81_000 }), ["--jev"], { TYPESAFE_API_KEY: KEY, CCF_JEV_URL: fake.url }, "too-large");
    assert.equal(fake.requests.length, 0);
  } finally { await fake.close(); }
});

for (const [mode, reason] of [["401", "unauthorized"], ["429", "rate-limited"], ["500", "http-500"], ["badjson", "bad-json"], ["hang", "timeout"]]) {
  test(`jev fallback: API ${mode} → ${reason}`, async () => {
    const fake = await startFake(/** @type {any} */ (mode));
    try {
      await assertFallback(makeMemoryDir(21), ["--jev"], { TYPESAFE_API_KEY: KEY, CCF_JEV_URL: fake.url, CCF_JEV_TIMEOUT_MS: "300" }, reason);
      assert.equal(fake.requests.length, 1);
    } finally { await fake.close(); }
  });
}
