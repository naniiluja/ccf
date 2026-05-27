// CCF context-usage helpers — pure logic for the context-nudge hook (PostToolUse).
// Reads the model's token usage from the session transcript (.jsonl) and decides when to
// nudge a proactive /compact. Kept pure + defensive so it is unit-testable with `node --test`
// and never throws — a bad read just means "no nudge", never a broken session.
//
// NOTE: the transcript .jsonl format is an UNDOCUMENTED internal Claude Code shape. This module
// reads it best-effort only; any parse/shape error returns null so the hook stays silent.

import { existsSync, readFileSync } from "node:fs";

// doc.md L222: the "dumb zone" begins ~40% context — nudge a focused compact on entry,
// before the degrade zone, rather than waiting for auto-compact (when the model is least sharp).
export const NUDGE_RATIO = 0.4;

/** @typedef {{ tokens: number, model: string, windowSize: number }} ContextUsage */

/**
 * Read the current context size from a transcript .jsonl file (best-effort, never throws).
 * Uses the LAST assistant line's `message.usage`: cache_read already folds in the whole
 * history, so the latest line alone reflects the current context — no need to sum the file.
 * @param {string} transcriptPath path to the session .jsonl transcript
 * @returns {ContextUsage | null} null if unreadable / no usage found
 */
export function readContextUsage(transcriptPath) {
  if (!transcriptPath || !existsSync(transcriptPath)) return null;
  let raw;
  try {
    raw = readFileSync(transcriptPath, "utf8");
  } catch {
    return null;
  }
  const lines = raw.split(/\r?\n/);
  // Walk backwards: we only want the most recent ASSISTANT usage. Other record types
  // (user / tool_result / summary) may also carry a usage block in the undocumented format,
  // so require type === "assistant" to read the real current context.
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (!line) continue;
    let obj;
    try {
      obj = JSON.parse(line);
    } catch {
      continue; // skip a corrupt line, keep looking
    }
    if (obj?.type !== "assistant") continue;
    const usage = obj?.message?.usage;
    if (!usage) continue;
    // Per-field coercion: a malformed field counts as 0 rather than poisoning the whole sum to NaN
    // (the transcript shape is undocumented, so be tolerant of one bad field).
    const tokens =
      finiteOrZero(usage.input_tokens) +
      finiteOrZero(usage.cache_creation_input_tokens) +
      finiteOrZero(usage.cache_read_input_tokens);
    const model = String(obj?.message?.model ?? "");
    return { tokens, model, windowSize: modelWindowSize(model) };
  }
  return null;
}

/**
 * Coerce a value to a finite number, or 0 if it isn't one.
 * @param {unknown} v
 * @returns {number}
 */
function finiteOrZero(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Infer the context window size (tokens) from a model id. Heuristic, used only for the nudge
 * threshold — if it guesses wrong it under-warns (safe direction), never breaks a session.
 * Matches a `1m` window only as an anchored suffix (e.g. "...-1m" or "...[1m]"), so a "1m"
 * substring lodged inside an id (e.g. "claude-haiku-4-1-mini") is NOT mistaken for a 1M window.
 * @param {string} model model id from the transcript
 * @returns {number} window size in tokens
 */
export function modelWindowSize(model) {
  // Match a `1m` window marker preceded by a `-` or `[` separator, optionally closed by `]`:
  // e.g. "...-1m" or "...[1m]". The separator stops a bare "...1m" inside an id from matching.
  if (/(?:-|\[)1m\]?$/i.test(String(model ?? ""))) return 1_000_000;
  return 200_000;
}

/**
 * True when context has reached the nudge threshold (a fraction of the window).
 * @param {number} tokens current context tokens
 * @param {number} windowSize model window size in tokens
 * @param {number} [ratio] threshold fraction (default NUDGE_RATIO)
 * @returns {boolean}
 */
export function shouldNudgeCompact(tokens, windowSize, ratio = NUDGE_RATIO) {
  return windowSize > 0 && tokens / windowSize >= ratio;
}

/**
 * Anti-spam dedup decision (pure). PostToolUse fires after every tool, so we only re-nudge
 * once context climbs another `step` points above the last mark.
 *
 * CRITICAL: `nextMark` is computed from the CURRENT pct regardless of `aboveThreshold`, and the
 * caller MUST persist `nextMark` on EVERY run (before any threshold early-exit). Otherwise the
 * mark cannot fall through the sub-threshold band where a /compact lands (e.g. 85% → 25%), and
 * the next climb back into the degrade zone would be silently suppressed — the bug this replaces.
 * The mark tracks the latest observed pct; `emit` gates only whether to nudge this run.
 *
 * @param {number} pct current context percentage (0-100)
 * @param {number} prevMark last recorded pct (NaN/undefined if none)
 * @param {boolean} aboveThreshold whether pct has reached the nudge threshold
 * @param {number} [step] minimum rise above the mark before re-nudging (default 10)
 * @returns {{ emit: boolean, nextMark: number }}
 */
export function decideNudge(pct, prevMark, aboveThreshold, step = 10) {
  const prev = Number(prevMark);
  // The mark always follows the current reading so it can drop after a compact.
  if (!aboveThreshold) return { emit: false, nextMark: pct };
  if (!Number.isFinite(prev)) return { emit: true, nextMark: pct }; // first reading at/above threshold
  if (pct >= prev + step) return { emit: true, nextMark: pct }; // climbed another step → re-nudge
  // At/above threshold but not a fresh step: stay silent, but still let the mark track downward
  // moves so a post-compact dip is recorded.
  return { emit: false, nextMark: Math.min(prev, pct) };
}

/**
 * Build a copy-paste /compact hint following Anthropic's documented pattern
 * ("Focus on X; preserve modified files + test commands; drop old tool output").
 * Embeds the in-progress task when known — docs favour specific over vague hints.
 * Only embeds the task when BOTH id and a non-empty title are present, so a malformed row
 * never produces "(undefined)" / "()" in the suggested command.
 * @param {{ id: string, title: string } | null} task the in-progress task, or null
 * @returns {string}
 */
export function buildCompactHint(task) {
  const id = task && task.id ? String(task.id).trim() : "";
  const title = task && task.title ? String(task.title).trim() : "";
  if (id && title) {
    return (
      `/compact Focus on task ${id} (${title}); ` +
      `preserve the modified files list and test commands; drop old tool output and dead ends.`
    );
  }
  return (
    "/compact Focus on the current task and key decisions; " +
    "preserve modified files and test commands; drop old tool output."
  );
}
