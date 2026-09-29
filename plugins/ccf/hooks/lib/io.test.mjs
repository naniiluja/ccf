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
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, utimesSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

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
// 1. plan-mode-guard.mjs → blockUserPrompt (the only remaining UserPromptSubmit hook)
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
