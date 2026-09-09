// CCF review-trace helpers — pure logic for the auto-verify Stop hook's cross-Stop guard.
// Decides, from the session transcript (.jsonl), whether a ccf-spec-checker review has already
// been spawned this session (a spawn tool_use, not proof the review finished — see
// hasSpecCheckerSpawn's note). Kept pure + defensive so it is unit-testable with `node --test`
// and never throws.
//
// NOTE: the transcript .jsonl format is an UNDOCUMENTED internal Claude Code shape. These helpers
// read it best-effort only; on any doubt the caller treats the result as "not yet run".

/**
 * Parse a .jsonl transcript blob into an array of records, skipping blank/corrupt lines.
 * @param {string} raw the raw file contents
 * @returns {Array<Record<string, any>>}
 */
export function parseJsonl(raw) {
  /** @type {Array<Record<string, any>>} */
  const records = [];
  for (const line of String(raw ?? "").split(/\r?\n/)) {
    const text = line.trim();
    if (!text) continue;
    try {
      records.push(JSON.parse(text));
    } catch {
      // skip a corrupt line, keep the rest
    }
  }
  return records;
}

// Tool names that spawn a subagent. The name is HARNESS-DEPENDENT: documented as
// `Task` in Claude Code docs, but surfaced as `Agent` (with a `subagent_type` param)
// in some runtimes. Keying the gate on the tool name alone deadlocks `Agent`-only
// runtimes; we accept either and let `subagent_type` be the real gate. Set so a
// future alias is a one-line add.
const SPAWN_TOOL_NAMES = new Set(["task", "agent"]);

/**
 * True when the transcript contains a subagent-spawn tool call delegating to the
 * ccf-spec-checker subagent — the evidence that a fresh-context review has run this
 * session (typically via `/ccf:check`). Matches whether the spawn tool is named `Task`
 * or `Agent` (the name is harness-dependent); the `subagent_type` is the real gate.
 *
 * NOTE (naming): this proves the review was CALLED, not that it FINISHED — since
 * Claude Code 2.1.198 an agent runs in the background by default, so a spawn tool_use
 * appearing in the transcript no longer implies the review has completed. Callers that
 * need "review is done" must not conflate the two.
 * @param {Array<Record<string, any>>} records parsed transcript records
 * @returns {boolean}
 */
export function hasSpecCheckerSpawn(records) {
  for (const r of records) {
    if (!r || r.type !== "assistant") continue;
    const content = r.message?.content;
    if (!Array.isArray(content)) continue;
    for (const block of content) {
      if (block?.type !== "tool_use") continue;
      // Coerce untrusted input so a missing `name` never throws (.toLowerCase).
      const name = String(block?.name ?? "").toLowerCase();
      if (!SPAWN_TOOL_NAMES.has(name)) continue;
      const sub = String(block?.input?.subagent_type ?? "");
      if (sub.includes("ccf-spec-checker")) return true;
    }
  }
  return false;
}
