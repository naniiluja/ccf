// CCF context-usage helpers — pure logic for the context-guard hook (UserPromptSubmit).
// Reads the model's token usage from the session transcript (.jsonl) and decides when to
// warn about a proactive /compact. Kept pure + defensive so it is unit-testable with `node --test`
// and never throws — a bad read just means "no nudge", never a broken session.
//
// NOTE: the transcript .jsonl format is an UNDOCUMENTED internal Claude Code shape. This module
// reads it best-effort only; any parse/shape error returns null so the hook stays silent.

import { existsSync, readFileSync } from "node:fs";

// doc.md L222: the "dumb zone" begins ~40% context — nudge a focused compact on entry,
// before the degrade zone, rather than waiting for auto-compact (when the model is least sharp).
export const NUDGE_RATIO = 0.4;

// Absolute token ceiling for the nudge. Claude Code runs Opus/Sonnet 4.x at a native 1M window,
// where 40% = 400k is effectively unreachable before auto-compact or session end — so the nudge
// would never fire. Cap the trigger at a reachable size. Ceiling only: on a 200k window 40% (80k)
// is lower and still governs, so small windows are unaffected.
export const NUDGE_ABS_CAP = 300_000;

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
 * Infer the context window size (tokens) from a model id. The id alone CANNOT reveal whether a
 * 1M-context beta is active (e.g. "claude-opus-4-7" runs at 1M here yet carries no marker), so
 * when in doubt this guesses the LARGER window: a wrong guess then UNDER-warns (relies on
 * auto-compact) instead of spamming a /compact nudge at low real usage — the failure mode this
 * fixes. Rules, in order:
 *   - explicit `-1m`/`[1m]` anchored suffix → 1M (a stray "1m" inside an id does NOT count);
 *   - current-generation Opus/Sonnet (Claude 4.x, e.g. claude-opus-4-7) → 1M;
 *   - Haiku, legacy Claude 3.x/2.x and unrecognised ids → the classic 200k window.
 * @param {string} model model id from the transcript
 * @returns {number} window size in tokens
 */
export function modelWindowSize(model) {
  const id = String(model ?? "").toLowerCase();
  if (/(?:-|\[)1m\]?$/.test(id)) return 1_000_000;
  if (/(?:opus|sonnet)-4/.test(id)) return 1_000_000;
  return 200_000;
}

/**
 * True when context has reached the nudge threshold: a fraction of the window, but never beyond an
 * absolute token ceiling. On a 1M window the bare 40% (400k) is effectively unreachable, so the cap
 * fires the nudge at a reachable absolute size; on a 200k window 40% (80k) is below the cap, so the
 * ratio still governs — the cap only bites on large windows.
 * @param {number} tokens current context tokens
 * @param {number} windowSize model window size in tokens
 * @param {number} [ratio] threshold fraction (default NUDGE_RATIO)
 * @param {number} [cap] absolute token ceiling (default NUDGE_ABS_CAP)
 * @returns {boolean}
 */
export function shouldNudgeCompact(tokens, windowSize, ratio = NUDGE_RATIO, cap = NUDGE_ABS_CAP) {
  if (windowSize <= 0) return false;
  return tokens >= Math.min(windowSize * ratio, cap);
}

/**
 * Decide what the context-guard hook should do this turn (pure). UserPromptSubmit fires once per
 * user turn — naturally rate-limited — so there is no dedup state: every over-threshold turn acts.
 * Below threshold → always silent. In soft mode (`hardBlock` false) an over-threshold turn warns.
 * In hard-block mode an over-threshold turn blocks, UNLESS the prompt is an escape (`/compact` or an
 * explicit `ccf:override`) — an escape surfaces a warning but must NOT block the compact itself.
 * @param {{ aboveThreshold: boolean, hardBlock?: boolean, isEscape?: boolean }} args
 * @returns {"silent" | "warn" | "block"}
 */
export function decideGuardAction({ aboveThreshold, hardBlock = false, isEscape = false }) {
  if (!aboveThreshold) return "silent";
  if (hardBlock && !isEscape) return "block";
  return "warn";
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
