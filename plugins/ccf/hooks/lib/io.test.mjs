// Tests for lib/io.mjs — the ONLY safety net for io.mjs (task 041). Before this file, hooks/lib/
// had 10 *.test.mjs files and NONE touched io.mjs directly (its shapes were only exercised
// indirectly, if at all, through hooks that happen to call it).
//
// Strategy: spawn each REAL hook (.mjs) as a child process with a purpose-built temp project dir
// (own .claude/rules, own PLAN.md, own transcript .jsonl) and assert the exact JSON/exit-code shape
// io.mjs's helpers produce. This is deliberately NOT a before/after repo snapshot — two of the real
// hooks under test (auto-verify.mjs, updatespec-nudge.mjs clause C) read a LIVE PLAN.md, and this
// very task edits the repo's PLAN.md, so a snapshot-diff approach would flip between runs. Every
// case below therefore points `cwd` at an isolated tmp directory, never at the live repo.
//
// Windows-clean per hooks.md: spawnSync(process.execPath, [...], { shell:false }) + os.tmpdir() +
// mkdtempSync + path.join — no `|` pipes, no single-quoted `echo` (POSIX-only), mirroring the
// pattern already used by freshness.mjs's own git probe.
//
// SPEED NOTE: this file spawns a real `node` child process per case (each pays ~20-30ms just to boot
// the runtime), so `hooks/lib`'s suite runs noticeably slower with this file than it would in-process. Re-measure with `node --test
// plugins/ccf/hooks/lib/*.test.mjs` rather than trusting a remembered count (testing.md's own lesson
// about hardcoded counts drifting). This is the INHERENT price of testing through real child processes
// rather than importing io.mjs's functions directly — and it has to be paid, because every exported
// io.mjs function ends its own process with `process.exit(...)`, so it cannot be exercised in-process
// without either forking anyway or refactoring exit out of io.mjs entirely (out of scope here). This
// slowness IS the point: it is what makes the suite a real safety net for io.mjs's actual stdout/exit
// contract, not something to "optimize" away by dropping process-level spawning.

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync, spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtempSync, mkdirSync, writeFileSync, utimesSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { planInjectMarkerPath } from "./plan-trigger.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const HOOKS_DIR = join(__dirname, "..");

// Every tmp dir this file creates (via makeTmpProject) is tracked here and removed once, after all
// tests, by the test.after hook below — otherwise each run leaves its "ccf-io-test-*" directories
// behind permanently (a real dogfood finding: 215 accumulated on this machine before this fix). `force: true` so a cleanup failure (e.g.
// a file already gone) can never itself turn a passing test suite red.
/** @type {string[]} */
const tmpDirsToClean = [];

test.after(() => {
  for (const dir of tmpDirsToClean) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // best-effort cleanup only — never fail the suite over a leftover tmp dir
    }
  }
});

/**
 * Run a real hook .mjs as a child process, Windows-clean (no shell, no pipes). `input` is either a
 * plain object (JSON-stringified, the common case) or a raw string passed through verbatim — used by
 * the readStdinJson tests below to feed empty/malformed stdin text directly.
 * @param {string} hookFile hook filename under hooks/ (e.g. "plan-mode-guard.mjs")
 * @param {Record<string, any> | string} input the stdin payload — an object (stringified) or a raw string
 * @param {string[]} [argv] extra CLI args (e.g. ["--auto-verify"])
 * @returns {{ stdout: string, stderr: string, status: number | null }}
 */
function runHook(hookFile, input, argv = []) {
  const res = spawnSync(
    process.execPath,
    [join(HOOKS_DIR, hookFile), ...argv],
    { input: typeof input === "string" ? input : JSON.stringify(input), encoding: "utf8", shell: false },
  );
  return { stdout: res.stdout ?? "", stderr: res.stderr ?? "", status: res.status };
}

/** Create a fresh, isolated tmp project dir (never the live repo), tracked for cleanup. @returns {string} */
function makeTmpProject() {
  const dir = mkdtempSync(join(tmpdir(), "ccf-io-test-"));
  tmpDirsToClean.push(dir);
  return dir;
}

/**
 * Write a fake session transcript (.jsonl) from an array of record objects, one JSON per line.
 * @param {string} dir directory to write into
 * @param {Record<string, any>[]} records
 * @returns {string} the transcript file path
 */
function writeTranscript(dir, records) {
  const file = join(dir, "transcript.jsonl");
  writeFileSync(file, records.map((r) => JSON.stringify(r)).join("\n") + "\n");
  return file;
}

// ---------------------------------------------------------------------------------------------
// TRANSCRIPT C — auto-verify: this session edited a code file, ran no test command, no review spawn.
function transcriptC_editedCodeNoReview(dir) {
  return writeTranscript(dir, [
    { type: "assistant", message: { content: [{ type: "tool_use", name: "Edit", input: { file_path: "src/app.mjs" } }] } },
  ]);
}

// TRANSCRIPT D — updatespec-nudge clause C: this session ran `git commit`.
function transcriptD_gitCommit(dir) {
  return writeTranscript(dir, [
    { type: "assistant", message: { content: [{ type: "tool_use", name: "Bash", input: { command: "git commit -m 'x'" } }] } },
  ]);
}

/** A PLAN.md with exactly one OPEN task (status in-review) — satisfies both findActiveTask (auto-verify) and findNonDoneTasks (updatespec clause C). */
function writePlanWithOpenTask(dir) {
  mkdirSync(join(dir, ".claude", "plan"), { recursive: true });
  writeFileSync(
    join(dir, ".claude", "plan", "PLAN.md"),
    "| # | Task | Layers | Gate | Predecessor | Status |\n" +
      "|---|---|---|---|---|---|\n" +
      "| 001 | Sample task | hooks | tsc | — | in-review |\n",
  );
}

// =================================================================================================
// 1. plan-mode-guard.mjs → blockUserPrompt (the only UserPromptSubmit hook that blocks)
// =================================================================================================

test("plan-mode-guard: /ccf:plan outside plan mode → blockUserPrompt (stderr + exit 2)", () => {
  const { stdout, stderr, status } = runHook("plan-mode-guard.mjs", {
    prompt: "/ccf:plan add a feature",
    permission_mode: "default",
  });
  // blockUserPrompt writes to STDERR and exits 2 — it prints no JSON at all, so stdout stays empty.
  assert.equal(status, 2);
  assert.ok(stderr.length > 0, "stderr must carry the blocking reason");
  assert.equal(stdout, "");
});

// =================================================================================================
// 2-3. emitContext → session-start.mjs / explore-guide-inject.mjs
// =================================================================================================

/**
 * Shared assertion block for every emitContext-shaped payload (task cc-2.1.220-realign): the exact
 * top-level key set, the exact hookSpecificOutput key set, the event name, and a non-empty
 * additionalContext. Previously copy-pasted per test — and one case (the prefixed agent_type test
 * below) had silently DROPPED the exact-key-set checks, the one gap in an otherwise-uniform group.
 * Routing all four callers through this one helper closes that gap by construction.
 * @param {any} parsed the JSON-parsed stdout
 * @param {string} eventName expected hookSpecificOutput.hookEventName (e.g. "SessionStart")
 */
function assertEmitContextShape(parsed, eventName) {
  assert.ok(parsed.hookSpecificOutput, "expected hookSpecificOutput");
  assert.deepEqual(Object.keys(parsed).sort(), ["hookSpecificOutput"]);
  assert.deepEqual(Object.keys(parsed.hookSpecificOutput).sort(), ["additionalContext", "hookEventName"]);
  assert.equal(parsed.hookSpecificOutput.hookEventName, eventName);
  assert.ok(parsed.hookSpecificOutput.additionalContext.length > 0, "additionalContext must be non-empty");
}

test("session-start (source=startup): CCF-managed project → emitContext non-empty additionalContext", () => {
  const dir = makeTmpProject();
  mkdirSync(join(dir, ".claude", "plan"), { recursive: true }); // managed = existsSync(planDir)
  const { stdout, status } = runHook("session-start.mjs", { cwd: dir, source: "startup" });
  assert.equal(status, 0);
  const parsed = JSON.parse(stdout);
  assertEmitContextShape(parsed, "SessionStart");
  assert.ok(
    parsed.hookSpecificOutput.additionalContext.includes("Claude Context First"),
    "additionalContext must carry the CCF reminder, not be empty/generic",
  );
});

test("explore-guide-inject: any spawn (matcher-gated by hooks.json, not by this hook) → emitContext non-empty", () => {
  const { stdout, status } = runHook("explore-guide-inject.mjs", { agent_type: "Explore" });
  assert.equal(status, 0);
  const parsed = JSON.parse(stdout);
  assertEmitContextShape(parsed, "SubagentStart");
});

// =================================================================================================
// 4. updatespec-nudge.mjs, NO flag → emitSystemMessage (single-channel path, must stay INVARIANT)
// =================================================================================================

test("updatespec-nudge (no flag), clause B (spec older than code, deliberate mtime order, non-git tmp dir): emitSystemMessage ONLY", () => {
  const dir = makeTmpProject();
  const rulesDir = join(dir, ".claude", "rules");
  mkdirSync(rulesDir, { recursive: true });
  const specFile = join(rulesDir, "testing.md");
  const codeFile = join(dir, "index.mjs");
  writeFileSync(specFile, "# spec\n");
  writeFileSync(codeFile, "// code\n");
  // Deliberate time order (not reliant on filesystem mtime granularity/sleep): spec set to the
  // past, code set to now — dir is NOT a git repo, so specsOlderThanCode falls back to mtime.
  const past = new Date(Date.now() - 60_000);
  const now = new Date();
  utimesSync(specFile, past, past);
  utimesSync(codeFile, now, now);

  const { stdout, status } = runHook("updatespec-nudge.mjs", { cwd: dir, stop_hook_active: false });
  assert.equal(status, 0);
  const parsed = JSON.parse(stdout);
  // INVARIANT: the default path is SINGLE-channel — systemMessage only, no hookSpecificOutput key
  // at all. Checking the exact key set (not just "systemMessage is present") is what catches a
  // regression that silently starts dual-emitting by default.
  assert.deepEqual(Object.keys(parsed), ["systemMessage"]);
  assert.ok(parsed.systemMessage.length > 0, "systemMessage must be non-empty");
  // systemMessage is now a short, neutral, DATA-only fact for the user (task cc-2.1.220-realign) —
  // the /ccf:check + /ccf:updatespec INSTRUCTION lives only in the model-facing directive
  // (additionalContext, exercised by the --dual-channel-stop test below), never hardcoded English
  // shown directly to the user.
  assert.ok(parsed.systemMessage.toLowerCase().includes("spec"), "must be the updatespec nudge, not an empty pass-through");
  // Regression guard (cc-2.1.220-realign correctness fix): the DEFAULT single-channel systemMessage
  // must itself carry the action to take, not just the bare fact — the model never reads it
  // (additionalContext is the only model-facing channel, gated behind --dual-channel-stop which
  // ships OFF), so a user on the shipped default previously got a fact with no next step at all.
  assert.ok(parsed.systemMessage.includes("/ccf:check"), "clause B systemMessage must name /ccf:check");
  assert.ok(parsed.systemMessage.includes("/ccf:updatespec"), "clause B systemMessage must name /ccf:updatespec");
});

test("updatespec-nudge (no flag), clause C (git commit + PLAN.md pending task, tmp dir — NOT the live repo): emitSystemMessage ONLY", () => {
  const dir = makeTmpProject();
  mkdirSync(join(dir, ".claude", "rules"), { recursive: true }); // required just to pass the "managed" gate; no .md → clause B stays off
  writePlanWithOpenTask(dir);
  const transcript = transcriptD_gitCommit(dir);

  const { stdout, status } = runHook("updatespec-nudge.mjs", {
    cwd: dir,
    transcript_path: transcript,
    stop_hook_active: false,
  });
  assert.equal(status, 0);
  const parsed = JSON.parse(stdout);
  assert.deepEqual(Object.keys(parsed), ["systemMessage"]);
  assert.ok(parsed.systemMessage.includes("001"), "must name the pending task id from THIS tmp dir's PLAN.md");
  // Regression guard (cc-2.1.220-realign correctness fix): same rationale as the clause-B case above —
  // the default single-channel systemMessage must name the action, not just the bare fact.
  assert.ok(parsed.systemMessage.includes("/ccf:check"), "clause C systemMessage must name /ccf:check");
});

/**
 * A CCF tmp project whose ARCHIVE.md holds `iterations` iterations (newest first), each with one task
 * file in archive/. With 11 iterations the oldest one's file is prunable at the default keep of 10.
 * @param {number} iterations
 * @returns {string}
 */
function makePruneProject(iterations) {
  const dir = makeTmpProject();
  mkdirSync(join(dir, ".claude", "rules"), { recursive: true });
  const planDir = join(dir, ".claude", "plan");
  mkdirSync(join(planDir, "archive"), { recursive: true });
  const lines = ["# Archive"];
  for (let k = 0; k < iterations; k++) {
    const id = String(200 + iterations - k);
    lines.push("", `## Origin: it-${id}`, "| # | Slice | Status |", "|---|---|---|", `| ${id} | s | done |`);
    writeFileSync(join(planDir, "archive", `task-${id}-x.md`), "x\n");
  }
  writeFileSync(join(planDir, "ARCHIVE.md"), lines.join("\n") + "\n");
  return dir;
}

// Decision table (task 070 clause E): prunable files {yes, no} x stop_hook_active {true, false} →
// nudge only on (yes, false). Clauses A-D stay off in every row (no transcript, no PLAN.md, no spec .md).
test("updatespec-nudge clause E: prunable task files + stop_hook_active false → names the absolute prune-archive command", () => {
  const dir = makePruneProject(11);
  const { stdout, status } = runHook("updatespec-nudge.mjs", { cwd: dir, stop_hook_active: false });
  assert.equal(status, 0);
  const parsed = JSON.parse(stdout);
  assert.deepEqual(Object.keys(parsed), ["systemMessage"]);
  const scriptPath = join(HOOKS_DIR, "..", "scripts", "prune-archive.mjs");
  assert.ok(parsed.systemMessage.includes(`node "${scriptPath}" --dir "${dir}"`), "must carry the absolute script path and project root");
  assert.ok(parsed.systemMessage.includes("1 archived task file"), "must name the count");
  assert.ok(!parsed.systemMessage.includes("archive-plan.mjs"), "clause D must stay off");
});

test("updatespec-nudge clause E: decision-table rows that must stay silent", () => {
  for (const [iterations, active] of [[11, true], [10, false], [10, true]]) {
    const dir = makePruneProject(/** @type {number} */ (iterations));
    const { stdout, status } = runHook("updatespec-nudge.mjs", { cwd: dir, stop_hook_active: active });
    assert.equal(status, 0);
    assert.equal(stdout, "", `iterations=${iterations} stop_hook_active=${active}`);
  }
});

test("updatespec-nudge clause D: fully-closed iteration → archive-plan command carries --dir with the project root", () => {
  const dir = makeTmpProject();
  mkdirSync(join(dir, ".claude", "rules"), { recursive: true });
  mkdirSync(join(dir, ".claude", "plan"), { recursive: true });
  writeFileSync(
    join(dir, ".claude", "plan", "PLAN.md"),
    "## Origin: it-1\n\n| # | Task | Status |\n|---|---|---|\n| 001 | Sample task | done |\n",
  );
  const { stdout, status } = runHook("updatespec-nudge.mjs", { cwd: dir, stop_hook_active: false });
  assert.equal(status, 0);
  const parsed = JSON.parse(stdout);
  const scriptPath = join(HOOKS_DIR, "..", "scripts", "archive-plan.mjs");
  assert.ok(parsed.systemMessage.includes(`node "${scriptPath}" --dir "${dir}" --apply`), "must carry the absolute script path and project root");
  assert.ok(!parsed.systemMessage.includes("prune-archive.mjs"), "clause E must stay off");
});

// =================================================================================================
// 5. updatespec-nudge.mjs --dual-channel-stop → emitStopAdvisory (BOTH channels)
// =================================================================================================

test("updatespec-nudge --dual-channel-stop: same clause-C trigger → BOTH additionalContext AND systemMessage", () => {
  const dir = makeTmpProject();
  mkdirSync(join(dir, ".claude", "rules"), { recursive: true });
  writePlanWithOpenTask(dir);
  const transcript = transcriptD_gitCommit(dir);

  const { stdout, status } = runHook(
    "updatespec-nudge.mjs",
    { cwd: dir, transcript_path: transcript, stop_hook_active: false },
    ["--dual-channel-stop"],
  );
  assert.equal(status, 0);
  const parsed = JSON.parse(stdout);
  assert.ok(parsed.hookSpecificOutput, "dual-channel path must carry hookSpecificOutput");
  // Exact key-set at BOTH levels: catches a future change that silently adds/drops a field on
  // emitStopAdvisory's payload, not just checks that the two channels are present.
  assert.deepEqual(Object.keys(parsed).sort(), ["hookSpecificOutput", "systemMessage"]);
  assert.deepEqual(Object.keys(parsed.hookSpecificOutput).sort(), ["additionalContext", "hookEventName"]);
  assert.equal(parsed.hookSpecificOutput.hookEventName, "Stop");
  assert.ok(parsed.hookSpecificOutput.additionalContext.length > 0, "additionalContext must be non-empty");
  assert.ok(parsed.systemMessage.length > 0, "systemMessage must be non-empty");
  // The two channels must carry DIFFERENT content (task cc-2.1.220-realign): additionalContext is a
  // model-facing <ccf>...</ccf> INSTRUCTION, systemMessage is a short neutral user-facing fact —
  // a regression that passes the same string to both would slip a hardcoded-English directive
  // straight to the user, undoing the very fix this test guards.
  assert.notEqual(parsed.hookSpecificOutput.additionalContext, parsed.systemMessage);
  assert.ok(parsed.hookSpecificOutput.additionalContext.includes("<ccf>"), "additionalContext must be the model directive");
  assert.ok(!parsed.systemMessage.includes("<ccf>"), "systemMessage must NOT leak the raw model directive tag to the user");
});

// =================================================================================================
// 6. auto-verify.mjs --auto-verify → blockStop
// =================================================================================================

test("auto-verify --auto-verify: in-review task + edited code + no review yet (tmp dir, NOT the live repo) → blockStop", () => {
  const dir = makeTmpProject();
  mkdirSync(join(dir, ".claude", "rules"), { recursive: true });
  writePlanWithOpenTask(dir);
  const transcript = transcriptC_editedCodeNoReview(dir);

  const { stdout, status } = runHook(
    "auto-verify.mjs",
    { cwd: dir, transcript_path: transcript, stop_hook_active: false },
    ["--auto-verify"],
  );
  assert.equal(status, 0);
  const parsed = JSON.parse(stdout);
  assert.equal(parsed.decision, "block");
  assert.ok(parsed.reason.length > 0, "reason must be non-empty — it drives the next main-loop turn");
  assert.ok(parsed.reason.includes("/ccf:check"));
  assert.ok(parsed.systemMessage.length > 0);
  // Exact key-set: blockStop's contract is EXACTLY decision+reason+systemMessage (io.mjs's own
  // JSDoc pins this shape) — catches a future change that silently adds/drops a field.
  assert.deepEqual(Object.keys(parsed).sort(), ["decision", "reason", "systemMessage"]);
});

// =================================================================================================
// readStdinJson — never crash on empty/TTY/malformed input (testing.md's own stated invariant,
// previously unexercised by any test in this file). Spawns a real hook with RAW stdin text
// (bypassing runHook's JSON.stringify) so each of readStdinJson's three defensive branches is hit.
// =================================================================================================

test("readStdinJson: empty stdin → {} → hook exits 0, never crashes", () => {
  const { status, stderr } = runHook("plan-mode-guard.mjs", "");
  assert.equal(status, 0);
  assert.equal(stderr, "");
});

test("readStdinJson: malformed JSON stdin (\"{{{\") → {} → hook exits 0, never crashes", () => {
  const { status, stderr } = runHook("plan-mode-guard.mjs", "{{{");
  assert.equal(status, 0);
  assert.equal(stderr, "");
});

test("readStdinJson: stdin literal \"null\" (valid JSON, not an object) → hook exits 0, never crashes", () => {
  const { status, stderr } = runHook("plan-mode-guard.mjs", "null");
  assert.equal(status, 0);
  assert.equal(stderr, "");
});

// =================================================================================================
// plan-skill-inject.mjs → emitContext("UserPromptSubmit") — the once-per-session plan-mode nudge.
// Each case uses a unique session_id (the hook dedupes through a marker file in the OS temp dir),
// and every marker a case might create is removed after the run.
// =================================================================================================

/** @type {string[]} */
const planInjectSessions = [];

test.after(() => {
  for (const sid of planInjectSessions) {
    const marker = planInjectMarkerPath(sid);
    if (marker) rmSync(marker, { force: true });
  }
});

/**
 * Run plan-skill-inject with a fresh session in a CCF-initialized (or not) tmp project.
 * @param {Record<string, any>} over payload fields overriding the plan-mode defaults
 * @param {{ managed?: boolean, sessionId?: string }} [opts]
 */
function runPlanInject(over, { managed = true, sessionId = randomUUID() } = {}) {
  const dir = makeTmpProject();
  if (managed) mkdirSync(join(dir, ".claude", "plan"), { recursive: true });
  planInjectSessions.push(sessionId);
  const result = runHook("plan-skill-inject.mjs", {
    cwd: dir,
    session_id: sessionId,
    permission_mode: "plan",
    prompt: "add a feature",
    ...over,
  });
  return { ...result, dir, sessionId };
}

test("plan-skill-inject: plan mode + CCF project → additionalContext naming ccf:plan, then silent for the same session", () => {
  const first = runPlanInject({});
  assert.equal(first.status, 0);
  assertEmitContextShape(JSON.parse(first.stdout), "UserPromptSubmit");
  assert.match(JSON.parse(first.stdout).hookSpecificOutput.additionalContext, /ccf:plan/);
  assert.ok(existsSync(/** @type {string} */ (planInjectMarkerPath(first.sessionId))), "marker written");

  // Same session again: the once-per-session marker keeps the hook silent.
  const second = runHook("plan-skill-inject.mjs", {
    cwd: first.dir,
    session_id: first.sessionId,
    permission_mode: "plan",
    prompt: "another prompt",
  });
  assert.equal(second.status, 0);
  assert.equal(second.stdout, "");
});

test("plan-skill-inject: outside plan mode → silent exit 0, no marker", () => {
  const r = runPlanInject({ permission_mode: "default" });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, "");
  assert.ok(!existsSync(/** @type {string} */ (planInjectMarkerPath(r.sessionId))));
});

test("plan-skill-inject: plan mode but project not CCF-initialized → silent", () => {
  const r = runPlanInject({}, { managed: false });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, "");
});

test("plan-skill-inject: prompt is already a /ccf: command → silent", () => {
  const r = runPlanInject({ prompt: "/ccf:plan add a feature" });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, "");
});

test("plan-skill-inject: ccf:plan already ran this session (transcript) → silent", () => {
  const dir = makeTmpProject();
  mkdirSync(join(dir, ".claude", "plan"), { recursive: true });
  const transcript = writeTranscript(dir, [
    { type: "assistant", message: { content: [{ type: "tool_use", name: "Skill", input: { skill: "ccf:plan" } }] } },
  ]);
  const sessionId = randomUUID();
  planInjectSessions.push(sessionId);
  const r = runHook("plan-skill-inject.mjs", {
    cwd: dir,
    session_id: sessionId,
    permission_mode: "plan",
    prompt: "add a feature",
    transcript_path: transcript,
  });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, "");
});

test("plan-skill-inject: no session_id → silent (cannot dedupe, so never nudges)", () => {
  const dir = makeTmpProject();
  mkdirSync(join(dir, ".claude", "plan"), { recursive: true });
  const r = runHook("plan-skill-inject.mjs", { cwd: dir, permission_mode: "plan", prompt: "x" });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, "");
});

test("plan-skill-inject: marker cannot be written → silent exit 0 (a failed write must not mean a nudge on every prompt)", () => {
  const dir = makeTmpProject();
  mkdirSync(join(dir, ".claude", "plan"), { recursive: true });
  // os.tmpdir() reads TEMP/TMP on Windows and TMPDIR on POSIX; point all three at a missing directory
  // so existsSync(marker) is false and writeFileSync throws.
  const missing = join(dir, "no-such-tmp");
  const res = spawnSync(process.execPath, [join(HOOKS_DIR, "plan-skill-inject.mjs")], {
    input: JSON.stringify({ cwd: dir, session_id: randomUUID(), permission_mode: "plan", prompt: "add a feature" }),
    encoding: "utf8",
    shell: false,
    env: { ...process.env, TEMP: missing, TMP: missing, TMPDIR: missing },
  });
  assert.equal(res.status, 0);
  assert.equal(res.stdout, "");
});

test("plan-skill-inject: empty / malformed / null stdin → exit 0, no output, never crashes", () => {
  for (const raw of ["", "{{{", "null"]) {
    const r = runHook("plan-skill-inject.mjs", raw);
    assert.equal(r.status, 0);
    assert.equal(r.stdout, "");
    assert.equal(r.stderr, "");
  }
});

// =================================================================================================
// Opt-in flags default OFF — the safety argument for --auto-verify / --enforce-tests /
// --dual-channel-stop is "off by default is harmless"; prove it by firing each hook WITHOUT its
// flag even when every OTHER gating signal is satisfied, and asserting silent exit 0/empty stdout.
// =================================================================================================

test("auto-verify WITHOUT --auto-verify: same conditions that would trigger blockStop → silent exit 0, empty stdout", () => {
  const dir = makeTmpProject();
  mkdirSync(join(dir, ".claude", "rules"), { recursive: true });
  writePlanWithOpenTask(dir);
  const transcript = transcriptC_editedCodeNoReview(dir);

  const { stdout, stderr, status } = runHook("auto-verify.mjs", {
    cwd: dir,
    transcript_path: transcript,
    stop_hook_active: false,
  }); // no ["--auto-verify"] arg
  assert.equal(status, 0);
  assert.equal(stdout, "");
  assert.equal(stderr, "");
});

// =================================================================================================
// completion-evidence.mjs — opt-in Stop hook that asks Jev (TypeSafe) about a task's evidence.
// The network is a real node:http server on 127.0.0.1 (the URL is overridden with CCF_JEV_URL), so the
// hook's actual fetch/abort path is exercised. spawnSync would block this process's event loop and the
// fake server could never answer, hence the async spawn below.
// =================================================================================================

const JEV_KEY = "test-key-DO-NOT-LEAK-1234";
const CRITERION_1 = "the gate runs without network access";
const CRITERION_2 = "every failure path exits 0";

/** Async twin of runHook: same contract, but the event loop stays free to serve the fake API. */
function runHookAsync(hookFile, input, argv = [], env = {}, cwd = undefined) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [join(HOOKS_DIR, hookFile), ...argv], {
      env: { ...process.env, ...env },
      shell: false,
      cwd,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("close", (status) => resolve({ stdout, stderr, status }));
    child.stdin.end(JSON.stringify(input));
  });
}

/**
 * Start a fake System One API. `mode` picks the reply; every request body is recorded.
 * @param {"one-unmet"|"all-met"|"400"|"401"|"429"|"529"|"bad-json"|"hang"} mode
 */
async function startFakeJev(mode) {
  /** @type {{ headers: Record<string, any>, body: any }[]} */
  const requests = [];
  const sockets = new Set();
  const server = createServer((req, res) => {
    let raw = "";
    req.on("data", (d) => (raw += d));
    req.on("end", () => {
      let body = null;
      try {
        body = JSON.parse(raw);
      } catch {}
      requests.push({ headers: req.headers, body });
      if (mode === "hang") return; // never answer: the hook must abort on its own
      if (mode === "400" || mode === "401" || mode === "429" || mode === "529") {
        res.statusCode = Number(mode);
        return res.end("{}");
      }
      if (mode === "bad-json") return res.end("{not json");
      const met = mode === "all-met";
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({
        model: "jev-latest",
        answers: {
          criterion_1: { noul: met ? 0.9 : 0.1 },
          criterion_2: { noul: 0.9 },
          scope_creep: { noul: 0.05 },
        },
        usage: {},
      }));
    });
  });
  server.on("connection", (s) => { sockets.add(s); s.on("close", () => sockets.delete(s)); });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${/** @type {any} */ (server.address()).port}`;
  const close = () => new Promise((r) => { for (const s of sockets) s.destroy(); server.close(() => r(undefined)); });
  return { url, requests, close };
}

/** git wrapper for fixtures; throws on failure so a broken fixture fails loudly rather than silently passing. */
function git(dir, ...args) {
  const r = spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", ...args], { cwd: dir, encoding: "utf8", shell: false });
  assert.equal(r.status, 0, `git ${args.join(" ")} failed: ${r.stderr}`);
}

/**
 * A CCF project in a real git repo: one in-review task with two acceptance criteria, a modified tracked
 * file (so `git diff HEAD` is non-empty), and a transcript that edited code and ran the tests.
 * @param {{ withEnvFile?: boolean }} [opts]
 */
function makeJevProject({ withEnvFile = false } = {}) {
  const dir = makeTmpProject();
  mkdirSync(join(dir, ".claude", "rules"), { recursive: true });
  mkdirSync(join(dir, ".claude", "plan"), { recursive: true });
  mkdirSync(join(dir, "src"), { recursive: true });
  writeFileSync(join(dir, ".claude", "plan", "PLAN.md"),
    "| # | Task | Layers | Gate | Predecessor | Status |\n|---|---|---|---|---|---|\n| 900 | Jev fixture task | hooks | tsc | — | in-review |\n");
  writeFileSync(join(dir, ".claude", "plan", "task-900-fixture.md"),
    `# Task 900\n\n## Goal\nx\n\n## Acceptance criteria (verifiable)\n- [ ] ${CRITERION_1}\n- [ ] ${CRITERION_2}\n\n## Test first\ny\n`);
  writeFileSync(join(dir, "src", "app.mjs"), "export const a = 1;\n");
  git(dir, "init", "-q");
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "init");
  writeFileSync(join(dir, "src", "app.mjs"), `export const a = 2; // ${randomUUID()}\n`); // unique per project → unique marker
  if (withEnvFile) writeFileSync(join(dir, ".env"), "API_SECRET=hunter2-TOPSECRET\n");
  const transcript = writeTranscript(dir, [
    { type: "assistant", message: { content: [{ type: "tool_use", id: "e1", name: "Edit", input: { file_path: "src/app.mjs" } }] } },
    { type: "assistant", message: { content: [{ type: "tool_use", id: "t1", name: "Bash", input: { command: "node --test" } }] } },
    { type: "user", message: { content: [{ type: "tool_result", tool_use_id: "t1", content: "# pass 7 # fail 0" }] } },
  ]);
  return { dir, transcript };
}

/** Run completion-evidence against a fake API with a private temp dir (so markers never touch the real one). */
async function runJev({ mode, project, argv = ["--completion-evidence"], key = JEV_KEY, extraInput = {}, timeoutMs }) {
  const fake = await startFakeJev(mode);
  const tmp = makeTmpProject();
  try {
    const env = { CCF_JEV_URL: fake.url, TEMP: tmp, TMP: tmp, TMPDIR: tmp, TYPESAFE_API_KEY: key ?? "" };
    if (timeoutMs) env.CCF_JEV_TIMEOUT_MS = String(timeoutMs);
    const out = await runHookAsync("completion-evidence.mjs",
      { cwd: project.dir, transcript_path: project.transcript, stop_hook_active: false, ...extraInput }, argv, env);
    return { ...out, requests: fake.requests, tmp, env };
  } finally {
    await fake.close();
  }
}

const assertSilent = (r, label) => {
  assert.equal(r.status, 0, `${label}: exit code`);
  assert.equal(r.stdout, "", `${label}: stdout`);
  assert.ok(!r.stderr.includes(JEV_KEY), `${label}: key must not appear on stderr`);
};

test("completion-evidence: one unmet criterion → systemMessage naming it, exit 0, key never printed, evidence sent", async () => {
  const project = makeJevProject({ withEnvFile: true });
  const r = await runJev({ mode: "one-unmet", project });
  assert.equal(r.status, 0);
  const parsed = JSON.parse(r.stdout);
  assert.deepEqual(Object.keys(parsed), ["systemMessage"]);
  assert.ok(parsed.systemMessage.includes(CRITERION_1), "names the unmet criterion");
  assert.ok(!parsed.systemMessage.includes(CRITERION_2), "does not name a met criterion");
  assert.ok(parsed.systemMessage.includes(".env"), "names the file it left out");
  assert.ok(!r.stdout.includes(JEV_KEY) && !r.stderr.includes(JEV_KEY));
  // what went over the wire
  assert.equal(r.requests.length, 1);
  const req = r.requests[0];
  assert.equal(req.headers.authorization, `Bearer ${JEV_KEY}`);
  assert.equal(req.body.model, "jev-latest");
  assert.deepEqual(req.body.state.task.acceptance_criteria, [CRITERION_1, CRITERION_2]);
  assert.ok(req.body.state.diff.includes("export const a = 2"), "tracked change is in the diff");
  assert.ok(!JSON.stringify(req.body).includes("hunter2-TOPSECRET"), "sensitive file content never leaves the machine");
  assert.ok(req.body.state.test_output.includes("# pass 7"), "last test output is included");
  assert.deepEqual(Object.keys(req.body.questions).sort(), ["criterion_1", "criterion_2", "scope_creep"]);
});

test("completion-evidence: every criterion met → silent (nothing to report)", async () => {
  const r = await runJev({ mode: "all-met", project: makeJevProject() });
  assertSilent(r, "all-met");
  assert.equal(r.requests.length, 1);
});

for (const mode of ["401", "429", "529", "bad-json"]) {
  test(`completion-evidence: API answers ${mode} → silent exit 0 (fail-open)`, async () => {
    const r = await runJev({ mode, project: makeJevProject() });
    assertSilent(r, mode);
  });
}

test("completion-evidence: API never answers → aborts at the deadline, silent exit 0", async () => {
  const t0 = Date.now();
  const r = await runJev({ mode: "hang", project: makeJevProject(), timeoutMs: 400 });
  assertSilent(r, "hang");
  assert.ok(Date.now() - t0 < 5000, "must give up long before the harness's 10s kill");
});

test("completion-evidence: missing key or missing flag → silent, and NO network call", async () => {
  for (const [label, opts] of [["no key", { key: "" }], ["no flag", { argv: [] }]]) {
    const r = await runJev({ mode: "one-unmet", project: makeJevProject(), ...opts });
    assertSilent(r, label);
    assert.equal(r.requests.length, 0, `${label}: must not call the API`);
  }
});

test("completion-evidence: stop_hook_active, no in-review task, no code edit → silent, no network call", async () => {
  const active = await runJev({ mode: "one-unmet", project: makeJevProject(), extraInput: { stop_hook_active: true } });
  assertSilent(active, "stop_hook_active"); assert.equal(active.requests.length, 0);

  const noTask = makeJevProject();
  writeFileSync(join(noTask.dir, ".claude", "plan", "PLAN.md"),
    "| # | Task | Layers | Gate | Predecessor | Status |\n|---|---|---|---|---|---|\n| 900 | Jev fixture task | hooks | tsc | — | in-progress |\n");
  const r2 = await runJev({ mode: "one-unmet", project: noTask });
  assertSilent(r2, "no in-review task"); assert.equal(r2.requests.length, 0);

  const noEdit = makeJevProject();
  writeTranscript(noEdit.dir, [{ type: "assistant", message: { content: [{ type: "text", text: "hi" }] } }]);
  const r3 = await runJev({ mode: "one-unmet", project: noEdit });
  assertSilent(r3, "no code edited"); assert.equal(r3.requests.length, 0);
});

test("completion-evidence: same task + same diff is asked only once (marker), a changed diff is asked again", async () => {
  const project = makeJevProject();
  const fake = await startFakeJev("one-unmet");
  const tmp = makeTmpProject();
  const env = { CCF_JEV_URL: fake.url, TEMP: tmp, TMP: tmp, TMPDIR: tmp, TYPESAFE_API_KEY: JEV_KEY };
  const input = { cwd: project.dir, transcript_path: project.transcript, stop_hook_active: false };
  try {
    const first = await runHookAsync("completion-evidence.mjs", input, ["--completion-evidence"], env);
    assert.ok(first.stdout.includes("systemMessage"));
    const second = await runHookAsync("completion-evidence.mjs", input, ["--completion-evidence"], env);
    assertSilent(second, "second run, same diff");
    writeFileSync(join(project.dir, "src", "app.mjs"), `export const a = 3; // ${randomUUID()}\n`);
    const third = await runHookAsync("completion-evidence.mjs", input, ["--completion-evidence"], env);
    assert.ok(third.stdout.includes("systemMessage"), "a changed diff is a new question");
    assert.equal(fake.requests.length, 2);
  } finally {
    await fake.close();
  }
});

test("completion-evidence: not a git repo, oversize payload, empty / malformed stdin → silent exit 0", async () => {
  const notGit = makeTmpProject();
  mkdirSync(join(notGit, ".claude", "rules"), { recursive: true });
  writePlanWithOpenTask(notGit);
  // a task file, so the hook gets past the "no task file" exit and really reaches the git step
  writeFileSync(join(notGit, ".claude", "plan", "task-001-x.md"), `## Acceptance criteria (verifiable)\n- [ ] ${CRITERION_1}\n`);
  const tr = transcriptC_editedCodeNoReview(notGit);
  const a = await runJev({ mode: "one-unmet", project: { dir: notGit, transcript: tr } });
  assertSilent(a, "not a git repo"); assert.equal(a.requests.length, 0);

  const big = makeJevProject();
  writeFileSync(join(big.dir, "src", "big.mjs"), "x".repeat(300_000));
  const b = await runJev({ mode: "one-unmet", project: big });
  assert.equal(b.status, 0);
  assert.equal(b.requests.length, 0, "an oversize diff is skipped, not truncated");
  const notice = JSON.parse(b.stdout).systemMessage;
  assert.match(notice, /not checked/i, "the user is told Jev did not run, instead of silence that reads as a pass");
  assert.match(notice, /80KB/);
  assert.ok(!b.stdout.includes(JEV_KEY));

  // Explicit fake key + closed port + empty cwd: these cases must not depend on (or touch) the developer's
  // real TYPESAFE_API_KEY, the real API, or this repo's own PLAN.md.
  const emptyCwd = makeTmpProject();
  const env = { TYPESAFE_API_KEY: JEV_KEY, CCF_JEV_URL: "http://127.0.0.1:1", TEMP: emptyCwd, TMP: emptyCwd, TMPDIR: emptyCwd };
  for (const raw of ["", "{{{", "null"]) {
    const child = await new Promise((resolve) => {
      const c = spawn(process.execPath, [join(HOOKS_DIR, "completion-evidence.mjs"), "--completion-evidence"], { env: { ...process.env, ...env }, cwd: emptyCwd, shell: false });
      let stdout = "";
      c.stdout.on("data", (d) => (stdout += d));
      c.on("close", (status) => resolve({ stdout, status }));
      c.stdin.end(raw);
    });
    assert.equal(child.status, 0, JSON.stringify(raw)); assert.equal(child.stdout, "", JSON.stringify(raw));
  }
});

test("completion-evidence: marker is written BEFORE the call, so a failing API is asked once, not on every Stop", async () => {
  const project = makeJevProject();
  const fake = await startFakeJev("429");
  const tmp = makeTmpProject();
  const env = { CCF_JEV_URL: fake.url, TEMP: tmp, TMP: tmp, TMPDIR: tmp, TYPESAFE_API_KEY: JEV_KEY };
  const input = { cwd: project.dir, transcript_path: project.transcript, stop_hook_active: false };
  try {
    assertSilent(await runHookAsync("completion-evidence.mjs", input, ["--completion-evidence"], env), "first Stop, API 429");
    assertSilent(await runHookAsync("completion-evidence.mjs", input, ["--completion-evidence"], env), "second Stop, same diff");
    assert.equal(fake.requests.length, 1, "the failed request must not be retried on the next Stop");
  } finally {
    await fake.close();
  }
});

test("completion-evidence: a hook killed mid-call (the harness's 10s kill) is not retried on the next Stop", async () => {
  // Only a process that dies DURING the request tells "marker before the call" from "marker after it":
  // a hook that survives the failure would write the marker either way.
  const project = makeJevProject();
  const fake = await startFakeJev("hang");
  const tmp = makeTmpProject();
  const env = { ...process.env, CCF_JEV_URL: fake.url, TEMP: tmp, TMP: tmp, TMPDIR: tmp, TYPESAFE_API_KEY: JEV_KEY };
  const input = { cwd: project.dir, transcript_path: project.transcript, stop_hook_active: false };
  try {
    const child = spawn(process.execPath, [join(HOOKS_DIR, "completion-evidence.mjs"), "--completion-evidence"], { env, shell: false });
    child.stdin.end(JSON.stringify(input));
    const closed = new Promise((r) => child.on("close", r));
    for (let i = 0; i < 100 && fake.requests.length === 0; i++) await new Promise((r) => setTimeout(r, 50));
    assert.equal(fake.requests.length, 1, "the first run reached the API");
    child.kill("SIGKILL");
    await closed;
    assertSilent(await runHookAsync("completion-evidence.mjs", input, ["--completion-evidence"], env), "next Stop after the kill");
    assert.equal(fake.requests.length, 1, "the killed request must not be repeated");
  } finally {
    await fake.close();
  }
});

test("completion-evidence: API unreachable at the hook level (connection refused) → silent exit 0", async () => {
  const project = makeJevProject();
  const tmp = makeTmpProject();
  const env = { CCF_JEV_URL: "http://127.0.0.1:1", TEMP: tmp, TMP: tmp, TMPDIR: tmp, TYPESAFE_API_KEY: JEV_KEY };
  const r = await runHookAsync("completion-evidence.mjs", { cwd: project.dir, transcript_path: project.transcript, stop_hook_active: false }, ["--completion-evidence"], env);
  assertSilent(r, "connection refused");
});

test("completion-evidence: HTTP 400 (request too large for the API) → says it did not check, once, instead of silence", async () => {
  const project = makeJevProject();
  const fake = await startFakeJev("400");
  const tmp = makeTmpProject();
  const env = { CCF_JEV_URL: fake.url, TEMP: tmp, TMP: tmp, TMPDIR: tmp, TYPESAFE_API_KEY: JEV_KEY };
  const input = { cwd: project.dir, transcript_path: project.transcript, stop_hook_active: false };
  try {
    const first = await runHookAsync("completion-evidence.mjs", input, ["--completion-evidence"], env);
    assert.equal(first.status, 0);
    assert.match(JSON.parse(first.stdout).systemMessage, /not checked/i);
    assert.ok(!first.stdout.includes(JEV_KEY));
    assertSilent(await runHookAsync("completion-evidence.mjs", input, ["--completion-evidence"], env), "second Stop");
    assert.equal(fake.requests.length, 1);
  } finally {
    await fake.close();
  }
});

test("completion-evidence: two tasks in-review at once is ambiguous → silent, no network call", async () => {
  const project = makeJevProject();
  writeFileSync(join(project.dir, ".claude", "plan", "PLAN.md"),
    "| # | Task | Layers | Gate | Predecessor | Status |\n|---|---|---|---|---|---|\n| 900 | Jev fixture task | hooks | tsc | — | in-review |\n| 901 | Another | hooks | tsc | 900 | in-review |\n");
  const r = await runJev({ mode: "one-unmet", project });
  assertSilent(r, "two in-review tasks");
  assert.equal(r.requests.length, 0);
});
test("completion-evidence: the not-checked notice for an oversize diff is shown once per task + diff, not on every Stop", async () => {
  const big = makeJevProject();
  writeFileSync(join(big.dir, "src", "big.mjs"), "x".repeat(300_000));
  const tmp = makeTmpProject();
  // closed port: if the size cap ever breaks, the request fails here instead of reaching the real API
  const env = { CCF_JEV_URL: "http://127.0.0.1:1", TEMP: tmp, TMP: tmp, TMPDIR: tmp, TYPESAFE_API_KEY: JEV_KEY };
  const input = { cwd: big.dir, transcript_path: big.transcript, stop_hook_active: false };
  const first = await runHookAsync("completion-evidence.mjs", input, ["--completion-evidence"], env);
  assert.match(JSON.parse(first.stdout).systemMessage, /not checked/i);
  const second = await runHookAsync("completion-evidence.mjs", input, ["--completion-evidence"], env);
  assertSilent(second, "second Stop, same oversize diff");
});