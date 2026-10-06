// Process-level tests for scripts/jev-verify-findings.mjs, against a local node:http fake of the System One
// API (URL overridden with CCF_JEV_URL) and a throwaway git repo. Lives in hooks/lib so the standard
// `node --test plugins/ccf/hooks/lib/*.test.mjs` run covers it. The script is spawned ASYNC: a sync
// spawn would block this process's event loop and the fake server could never answer.

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir, devNull } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

process.env.GIT_CONFIG_GLOBAL = devNull;
process.env.GIT_CONFIG_NOSYSTEM = "1";

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "scripts", "jev-verify-findings.mjs");
const KEY = "verify-key-DO-NOT-LEAK-4321";
const REPORT = [
  "### Violations",
  '- FAIL: rule — `src/a.js:1` — console.log — rule: "Never use console.log" (`rules/logging.md:2`) — confidence 95 — fix',
  "- FAIL: scope — `src/b.js:1` — outside the task — confidence 85 — revert",
].join("\n");

/** @type {string[]} */
const dirs = [];
test.after(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

/** @param {string} dir @param {string[]} args */
function git(dir, args) {
  const r = spawnSync("git", args, { cwd: dir, encoding: "utf8", shell: false });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
}

/** A repo whose feature branch changes src/a.js, src/b.js and a sensitive .env against main. */
function makeRepo() {
  const dir = mkdtempSync(join(tmpdir(), "ccf-verify-test-"));
  dirs.push(dir);
  git(dir, ["init", "-q", "-b", "main"]);
  git(dir, ["config", "user.email", "t@example.com"]);
  git(dir, ["config", "user.name", "t"]);
  writeFileSync(join(dir, "README"), "base\n");
  git(dir, ["add", "-A"]);
  git(dir, ["commit", "-q", "-m", "base"]);
  git(dir, ["checkout", "-q", "-b", "feature"]);
  spawnSync("mkdir", ["-p", join(dir, "src")]);
  writeFileSync(join(dir, "src", "a.js"), "console.log('x');\n");
  writeFileSync(join(dir, "src", "b.js"), "export const b = 1;\n");
  writeFileSync(join(dir, ".env"), "TOKEN=secret-value\n");
  git(dir, ["add", "-A"]);
  git(dir, ["commit", "-q", "-m", "feature"]);
  return dir;
}

/** @param {"ok"|"429"} mode */
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
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ model: "jev-latest", answers: { finding_1: { noul: 0.9 }, finding_2: { noul: 0.1 } }, usage: {} }));
    });
  });
  server.on("connection", (s) => { sockets.add(s); s.on("close", () => sockets.delete(s)); });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${/** @type {any} */ (server.address()).port}`;
  return { url, requests, close: () => new Promise((r) => { for (const s of sockets) s.destroy(); server.close(() => r(undefined)); }) };
}

/**
 * @param {string} dir @param {string} stdin @param {Record<string, string>} env @param {string[]} [extra]
 * @returns {Promise<{ stdout: string, stderr: string, status: number | null }>}
 */
function run(dir, stdin, env, extra = []) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [SCRIPT, "--dir", dir, ...extra], { env: { ...process.env, TYPESAFE_API_KEY: "", ...env }, shell: false });
    let stdout = "", stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("close", (status) => resolve({ stdout, stderr, status }));
    child.stdin.end(stdin);
  });
}

test("jev-verify-findings: annotates every FAIL, keeps both, strips .env, never prints the key", async () => {
  const fake = await startFake("ok");
  try {
    const r = await run(makeRepo(), REPORT, { TYPESAFE_API_KEY: KEY, CCF_JEV_URL: fake.url });
    assert.equal(r.status, 0);
    assert.ok(!r.stdout.includes(KEY) && !r.stderr.includes(KEY));
    const out = JSON.parse(r.stdout);
    assert.equal(out.ok, true);
    assert.equal(out.findings.length, 2);
    assert.ok(out.findings.every((/** @type {any} */ f) => f.marker === "FAIL:"));
    assert.deepEqual(out.findings.map((/** @type {any} */ f) => f.verdict), ["confirmed", "not-confirmed"]);
    assert.deepEqual(out.omitted, [".env"]);
    assert.equal(fake.requests.length, 1);
    assert.equal(fake.requests[0].auth, `Bearer ${KEY}`);
    assert.doesNotMatch(fake.requests[0].body.state.diff, /secret-value/);
    assert.match(fake.requests[0].body.state.diff, /src\/a\.js/);
  } finally {
    await fake.close();
  }
});

test("jev-verify-findings: no key → reason no-key, exit 0, no request", async () => {
  const fake = await startFake("ok");
  try {
    const r = await run(makeRepo(), REPORT, { CCF_JEV_URL: fake.url });
    assert.equal(r.status, 0);
    assert.equal(JSON.parse(r.stdout).reason, "no-key");
    assert.equal(fake.requests.length, 0);
  } finally {
    await fake.close();
  }
});

test("jev-verify-findings: a report with no FAIL: → reason no-findings, no request", async () => {
  const fake = await startFake("ok");
  try {
    const r = await run(makeRepo(), "### Conforms\n- PASS: all good\n", { TYPESAFE_API_KEY: KEY, CCF_JEV_URL: fake.url });
    assert.equal(r.status, 0);
    assert.equal(JSON.parse(r.stdout).reason, "no-findings");
    assert.equal(fake.requests.length, 0);
  } finally {
    await fake.close();
  }
});

test("jev-verify-findings: API 429 → reason rate-limited, findings still listed unjudged, exit 0", async () => {
  const fake = await startFake("429");
  try {
    const r = await run(makeRepo(), REPORT, { TYPESAFE_API_KEY: KEY, CCF_JEV_URL: fake.url });
    assert.equal(r.status, 0);
    const out = JSON.parse(r.stdout);
    assert.equal(out.ok, false);
    assert.equal(out.reason, "rate-limited");
    assert.equal(out.findings.length, 2);
    assert.ok(out.findings.every((/** @type {any} */ f) => f.verdict === "unjudged" && f.marker === "FAIL:"));
  } finally {
    await fake.close();
  }
});

test("jev-verify-findings: unknown base ref or no git repo → reason no-diff, exit 0", async () => {
  const fake = await startFake("ok");
  try {
    const bad = await run(makeRepo(), REPORT, { TYPESAFE_API_KEY: KEY, CCF_JEV_URL: fake.url }, ["--base", "does-not-exist"]);
    assert.equal(JSON.parse(bad.stdout).reason, "no-diff");
    const plain = mkdtempSync(join(tmpdir(), "ccf-verify-nogit-"));
    dirs.push(plain);
    const nogit = await run(plain, REPORT, { TYPESAFE_API_KEY: KEY, CCF_JEV_URL: fake.url });
    assert.equal(nogit.status, 0);
    assert.equal(JSON.parse(nogit.stdout).reason, "no-diff");
    assert.equal(fake.requests.length, 0);
  } finally {
    await fake.close();
  }
});
