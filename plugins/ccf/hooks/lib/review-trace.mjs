// CCF review-trace helpers — pure logic for the plan-review-gate hook (PreToolUse / ExitPlanMode).
// Decides, from the session transcript (.jsonl), whether the current /ccf-plan session has already
// had its plan reviewed by the ccf-spec-checker subagent. Kept pure + defensive so it is
// unit-testable with `node --test` and never throws.
//
// NOTE: the transcript .jsonl format is an UNDOCUMENTED internal Claude Code shape. These helpers
// read it best-effort only; on any doubt the caller treats the result as "allow" (never block wrongly).

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

/**
 * True when the transcript shows this is a /ccf-plan session (the user invoked the command in
 * either its namespaced `/ccf:ccf-plan` or bare `/ccf-plan` form). Outside such a session the gate
 * must NOT fire, so this scopes the deny to CCF planning only.
 * @param {Array<Record<string, any>>} records parsed transcript records
 * @returns {boolean}
 */
export function hasCcfPlanCommand(records) {
  for (const r of records) {
    if (!r || r.type !== "user") continue;
    const text = JSON.stringify(r.message?.content ?? r.message ?? r);
    if (/\/ccf:ccf-plan|\/ccf-plan/.test(text)) return true;
  }
  return false;
}

// Tool names that spawn a subagent. The name is HARNESS-DEPENDENT: documented as
// `Task` in Claude Code docs, but surfaced as `Agent` (with a `subagent_type` param)
// in some runtimes. Keying the gate on the tool name alone deadlocks `Agent`-only
// runtimes; we accept either and let `subagent_type` be the real gate. Set so a
// future alias is a one-line add.
const SPAWN_TOOL_NAMES = new Set(["task", "agent"]);

/**
 * True when the transcript contains a subagent-spawn tool call delegating to the
 * ccf-spec-checker subagent — the evidence that the plan was put through a
 * fresh-context review. Matches whether the spawn tool is named `Task` or `Agent`
 * (the name is harness-dependent); the `subagent_type` is the real gate.
 * @param {Array<Record<string, any>>} records parsed transcript records
 * @returns {boolean}
 */
export function hasSpecCheckerReview(records) {
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
