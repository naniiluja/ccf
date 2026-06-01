// Tests for lib/context-usage.mjs — node --test, no dependency.
// Covers the pure helpers that drive the context-guard hook: transcript parsing,
// model window sizing, threshold check, the guard-action decision, and the compact-hint copy.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  readContextUsage,
  modelWindowSize,
  shouldNudgeCompact,
  decideGuardAction,
  buildCompactHint,
  NUDGE_RATIO,
  NUDGE_ABS_CAP,
} from "./context-usage.mjs";

/** Write `lines` (array of objects) as a .jsonl transcript, return its path. */
function tmpTranscript(lines) {
  const dir = mkdtempSync(join(tmpdir(), "ccf-ctx-test-"));
  const file = join(dir, "t.jsonl");
  writeFileSync(file, lines.map((l) => (typeof l === "string" ? l : JSON.stringify(l))).join("\n"), "utf8");
  return { file, dir };
}

/** Build an assistant transcript line with a given usage block. */
function assistantLine(usage, model = "claude-opus-4-7") {
  return { type: "assistant", message: { model, usage } };
}

// --- readContextUsage --------------------------------------------------------

test("readContextUsage: null when the path does not exist", () => {
  assert.equal(readContextUsage(join(tmpdir(), "no-such-transcript.jsonl")), null);
});

test("readContextUsage: sums input + cache_creation + cache_read of the LAST assistant line", () => {
  const { file, dir } = tmpTranscript([
    { type: "user", message: { content: "hi" } },
    assistantLine({ input_tokens: 1, cache_creation_input_tokens: 10, cache_read_input_tokens: 100, output_tokens: 5 }),
    { type: "user", message: { content: "more" } },
    assistantLine({ input_tokens: 2, cache_creation_input_tokens: 20, cache_read_input_tokens: 200, output_tokens: 9 }),
  ]);
  try {
    const u = readContextUsage(file);
    assert.equal(u.tokens, 2 + 20 + 200); // last line only; output ignored
    assert.equal(u.model, "claude-opus-4-7");
    assert.equal(u.windowSize, 1_000_000); // opus-4.x is treated as a 1M window
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("readContextUsage: skips corrupt JSON lines, still reads the last good one", () => {
  const { file, dir } = tmpTranscript([
    assistantLine({ input_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 50, output_tokens: 1 }),
    "{ this is not valid json",
    "",
  ]);
  try {
    const u = readContextUsage(file);
    assert.equal(u.tokens, 1 + 0 + 50);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("readContextUsage: null when no line has message.usage", () => {
  const { file, dir } = tmpTranscript([
    { type: "user", message: { content: "hi" } },
    { type: "system", subtype: "info" },
  ]);
  try {
    assert.equal(readContextUsage(file), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("readContextUsage: missing usage subfields coerce to 0", () => {
  const { file, dir } = tmpTranscript([assistantLine({ cache_read_input_tokens: 70 })]);
  try {
    assert.equal(readContextUsage(file).tokens, 70);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("readContextUsage: ignores a non-assistant line that also carries message.usage", () => {
  // Bug #4: the LAST usage-bearing line is a tool_result/summary, NOT an assistant turn.
  // Must skip it and read the most recent assistant usage instead.
  const { file, dir } = tmpTranscript([
    assistantLine({ input_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 90 }),
    { type: "summary", message: { model: "x", usage: { input_tokens: 9999, cache_read_input_tokens: 9999 } } },
  ]);
  try {
    assert.equal(readContextUsage(file).tokens, 1 + 0 + 90); // assistant line, not the summary
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("readContextUsage: a malformed token field counts as 0, not NaN (whole reading survives)", () => {
  // Bug #5: a non-numeric field must not poison the sum to NaN and discard the reading.
  const { file, dir } = tmpTranscript([
    assistantLine({ input_tokens: {}, cache_creation_input_tokens: 5, cache_read_input_tokens: 60 }),
  ]);
  try {
    const u = readContextUsage(file);
    assert.equal(u.tokens, 0 + 5 + 60); // bad input_tokens → 0, rest preserved
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// --- modelWindowSize ---------------------------------------------------------

test("modelWindowSize: current-gen Opus/Sonnet 4.x → 1M (id can't reveal the beta, so assume larger)", () => {
  assert.equal(modelWindowSize("claude-opus-4-7"), 1_000_000);
  assert.equal(modelWindowSize("claude-opus-4-1"), 1_000_000);
  assert.equal(modelWindowSize("claude-sonnet-4-6"), 1_000_000);
});

test("modelWindowSize: explicit 1m suffix → 1M even for a 200k family (both bracket and dash forms)", () => {
  assert.equal(modelWindowSize("claude-haiku-4-5-1m"), 1_000_000);
  assert.equal(modelWindowSize("claude-haiku-4-5[1m]"), 1_000_000);
});

test("modelWindowSize: Haiku / legacy 3.x / empty → 200k", () => {
  assert.equal(modelWindowSize("claude-haiku-4-5"), 200_000);
  assert.equal(modelWindowSize("claude-3-7-sonnet-20250219"), 200_000); // legacy sonnet, not 4.x
  assert.equal(modelWindowSize(""), 200_000);
});

test("modelWindowSize: a stray '1m' inside an id is NOT a 1M marker", () => {
  assert.equal(modelWindowSize("claude-haiku-4-1-mini"), 200_000);
  assert.equal(modelWindowSize("model1m"), 200_000); // no separator before 1m → not a window marker
  assert.equal(modelWindowSize("model-21m"), 200_000); // '21m' is not a '1m' marker
});

// --- shouldNudgeCompact ------------------------------------------------------

test("shouldNudgeCompact: at/above 40% → true", () => {
  assert.equal(shouldNudgeCompact(80_000, 200_000), true); // exactly 40%
  assert.equal(shouldNudgeCompact(120_000, 200_000), true);
});

test("shouldNudgeCompact: below 40% → false", () => {
  assert.equal(shouldNudgeCompact(70_000, 200_000), false);
});

test("shouldNudgeCompact: windowSize 0 → false (never divide-by-zero nudge)", () => {
  assert.equal(shouldNudgeCompact(50_000, 0), false);
});

test("NUDGE_RATIO is pinned to the documented 40% (doc.md L222)", () => {
  // Pin the constant directly so a silent drift (e.g. 0.45) fails loudly, not only by fixture luck.
  assert.equal(NUDGE_RATIO, 0.4);
});

test("NUDGE_ABS_CAP is pinned to 300k (the proactive-compact ceiling for huge windows)", () => {
  assert.equal(NUDGE_ABS_CAP, 300_000);
});

test("shouldNudgeCompact: absolute cap makes a 1M window nudge before the unreachable 40% (400k)", () => {
  // 40% of 1M = 400k is never reached in practice (auto-compact / session end first), so without a
  // cap the nudge would stay silent forever. The cap fires it at a reachable absolute token count.
  assert.equal(shouldNudgeCompact(300_000, 1_000_000), true); // at the cap
  assert.equal(shouldNudgeCompact(299_000, 1_000_000), false); // just below the cap
  assert.equal(shouldNudgeCompact(400_000, 1_000_000), true); // well above the cap
});

test("shouldNudgeCompact: the cap is a ceiling, never raising a small window above its 40%", () => {
  // 200k window: 40% = 80k is below the 300k cap, so the ratio still governs (behaviour unchanged).
  assert.equal(shouldNudgeCompact(80_000, 200_000), true);
  assert.equal(shouldNudgeCompact(79_000, 200_000), false);
});

// --- decideGuardAction (warn-mode slice) -------------------------------------

test("decideGuardAction: above threshold, soft (hardBlock false) → warn", () => {
  assert.equal(decideGuardAction({ aboveThreshold: true, hardBlock: false }), "warn");
});

test("decideGuardAction: below threshold, soft → silent", () => {
  assert.equal(decideGuardAction({ aboveThreshold: false, hardBlock: false }), "silent");
});

// --- decideGuardAction (full decision-table: hardBlock × aboveThreshold × isEscape) -----------

test("decideGuardAction: full 8-row decision-table over hardBlock × aboveThreshold × isEscape", () => {
  const expected = [
    // hardBlock, aboveThreshold, isEscape, action
    [false, false, false, "silent"],
    [false, false, true, "silent"],
    [false, true, false, "warn"],
    [false, true, true, "warn"],
    [true, false, false, "silent"],
    [true, false, true, "silent"],
    [true, true, false, "block"],
    [true, true, true, "warn"], // escape surfaces a warning but does NOT block the compact itself
  ];
  for (const [hardBlock, aboveThreshold, isEscape, action] of expected) {
    assert.equal(
      decideGuardAction({ aboveThreshold, hardBlock, isEscape }),
      action,
      `hardBlock=${hardBlock} aboveThreshold=${aboveThreshold} isEscape=${isEscape}`,
    );
  }
});

test("decideGuardAction: never 'block' when hardBlock is false", () => {
  for (const aboveThreshold of [false, true]) {
    for (const isEscape of [false, true]) {
      assert.notEqual(decideGuardAction({ aboveThreshold, hardBlock: false, isEscape }), "block");
    }
  }
});

test("decideGuardAction: never 'block' below threshold even in hard-block mode", () => {
  for (const isEscape of [false, true]) {
    assert.notEqual(decideGuardAction({ aboveThreshold: false, hardBlock: true, isEscape }), "block");
  }
});

test("decideGuardAction: escape + hardBlock + above → 'warn', not 'block'", () => {
  assert.equal(decideGuardAction({ aboveThreshold: true, hardBlock: true, isEscape: true }), "warn");
});

// --- buildCompactHint --------------------------------------------------------

test("buildCompactHint: with a task embeds id + title and the Focus/preserve/drop pattern", () => {
  const hint = buildCompactHint({ id: "003", title: "Add auth flow" });
  assert.match(hint, /^\/compact /);
  assert.match(hint, /task 003/);
  assert.match(hint, /Add auth flow/);
  assert.match(hint, /[Pp]reserve/);
  assert.match(hint, /drop/i);
});

test("buildCompactHint: without a task still follows Focus/preserve/drop", () => {
  const hint = buildCompactHint(null);
  assert.match(hint, /^\/compact /);
  assert.match(hint, /[Ff]ocus on/);
  assert.match(hint, /[Pp]reserve/);
  assert.match(hint, /drop/i);
});

test("buildCompactHint: blank/undefined title falls back to generic (no '()' or 'undefined')", () => {
  // Bug #8: must never interpolate an empty or missing title into the suggested command.
  for (const task of [{ id: "003", title: "" }, { id: "003" }, { id: "", title: "x" }]) {
    const hint = buildCompactHint(/** @type {any} */ (task));
    assert.doesNotMatch(hint, /\(\s*\)/); // no empty parens
    assert.doesNotMatch(hint, /undefined/); // no literal undefined
    assert.match(hint, /^\/compact Focus on/);
  }
});
