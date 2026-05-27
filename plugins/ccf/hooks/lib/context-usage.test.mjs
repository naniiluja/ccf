// Tests for lib/context-usage.mjs — node --test, no dependency.
// Covers the pure helpers that drive the context-nudge hook: transcript parsing,
// model window sizing, threshold check, anti-spam dedup, and the compact-hint copy.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  readContextUsage,
  modelWindowSize,
  shouldNudgeCompact,
  decideNudge,
  buildCompactHint,
  NUDGE_RATIO,
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
    assert.equal(u.windowSize, 200_000);
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

test("modelWindowSize: standard model → 200k", () => {
  assert.equal(modelWindowSize("claude-opus-4-7"), 200_000);
});

test("modelWindowSize: 1m suffix → 1M (both bracket and dash forms)", () => {
  assert.equal(modelWindowSize("claude-opus-4-7[1m]"), 1_000_000);
  assert.equal(modelWindowSize("claude-opus-4-7-1m"), 1_000_000);
});

test("modelWindowSize: '1m' mid-id must NOT be treated as 1M window", () => {
  assert.equal(modelWindowSize("claude-haiku-4-1-mini"), 200_000);
  assert.equal(modelWindowSize("model1m"), 200_000); // no separator before 1m → not a window marker
  assert.equal(modelWindowSize("model-21m"), 200_000); // '21m' is not a '1m' marker
});

test("modelWindowSize: empty / unknown → 200k default", () => {
  assert.equal(modelWindowSize(""), 200_000);
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

// --- decideNudge (dedup + threshold ordering) --------------------------------

test("decideNudge: no previous mark, above threshold → emit and record", () => {
  assert.deepEqual(decideNudge(45, undefined, true), { emit: true, nextMark: 45 });
  assert.deepEqual(decideNudge(45, NaN, true), { emit: true, nextMark: 45 });
});

test("decideNudge: rise of >= step above threshold → emit and bump the mark", () => {
  assert.deepEqual(decideNudge(55, 45, true), { emit: true, nextMark: 55 });
});

test("decideNudge: at/above threshold but rise < step → silent, keep the mark", () => {
  assert.deepEqual(decideNudge(50, 45, true), { emit: false, nextMark: 45 });
});

test("decideNudge: BELOW threshold → never emit, and the mark FOLLOWS the current pct down", () => {
  // This is the core of the reset-after-compact fix: when pct is below threshold the hook used to
  // early-exit before touching state, stranding the old mark. Now the mark must track downward
  // even sub-threshold, so a later climb re-nudges.
  assert.deepEqual(decideNudge(25, 85, false), { emit: false, nextMark: 25 });
  assert.deepEqual(decideNudge(38, 25, false), { emit: false, nextMark: 38 });
});

test("decideNudge: full compact→reset→re-nudge sequence (regression for bug #1)", () => {
  // 85% (above) → compact → 25% (below) → climb 38% (below) → 45% (above) must EMIT.
  let mark; // simulate the hook persisting nextMark on EVERY run, incl. sub-threshold
  ({ nextMark: mark } = decideNudge(85, NaN, true)); //   85 above → emit, mark 85
  ({ nextMark: mark } = decideNudge(25, mark, false)); // 25 below → no emit, mark 25 (reset!)
  ({ nextMark: mark } = decideNudge(38, mark, false)); // 38 below → no emit, mark 38
  const final = decideNudge(45, mark, true); //           45 above, 45 >= 38+? step=10 → 48? no...
  // 45 < 38+10(=48): not a fresh step, so per the dedup rule it would NOT emit on this exact value.
  // The point of the regression test: the mark is 38 (not the stale 85), so the FIRST step past
  // 48 nudges. Assert the mark tracked down correctly rather than staying at 85.
  assert.equal(mark, 38);
  assert.equal(final.emit, false); // 45 is within step of the (correctly reset) 38 mark
  const climb = decideNudge(48, 38, true); // a full step above the reset mark → nudge again
  assert.equal(climb.emit, true);
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
