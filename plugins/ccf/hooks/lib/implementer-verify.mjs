// CCF implementer-verify helpers — pure logic for the opt-in SubagentStop implementer-verify-gate.
// Decides whether a spawned ccf-implementer must be BLOCKED from stopping because its final message
// carries no TEST-RESULT evidence (per the pinned Return format in agents/ccf-implementer.md).
// Kept pure + defensive so it is unit-testable with `node --test` and never throws.
//
// Message resolution order (grounded via code.claude.com/docs/en/hooks + /sub-agents): the SubagentStop
// payload documents `last_assistant_message` — resolved by `resolveLastMessage` and used as the
// PRIMARY source. `transcript_path` is NOT a documented SubagentStop field; `extractLastAssistantText`
// remains only as a DEFENSIVE FALLBACK for harnesses that provide a transcript instead (task 034 —
// SubagentStop's loop-guard/transcript shape were unconfirmed by docs at authoring time; 034a observes
// the real payload).

/**
 * Recognize the ccf-implementer agent type, defensively (harness-dependent casing/spacing).
 * Coerces non-string input to "" so it never throws. Empty/missing → false.
 * @param {unknown} agentType the input.agent_type field from a SubagentStop payload
 * @returns {boolean}
 */
export function isImplementer(agentType) {
  const type = typeof agentType === "string" ? agentType : "";
  if (!type) return false;
  return type.toLowerCase().includes("ccf-implementer");
}

/**
 * True when the implementer's final message carries TEST-RESULT evidence — either a real result
 * (`TEST-RESULT: <command> → <pass/fail>`) or the explicit prose-only declaration
 * (`TEST-RESULT: n/a (no test surface)`, valid per the pinned Return format). Coerces non-string
 * input to "" (→ false) so it never throws.
 * @param {unknown} text the subagent's last assistant message
 * @returns {boolean}
 */
export function implementerReportedTests(text) {
  const message = typeof text === "string" ? text : "";
  if (!message) return false;
  return /TEST-RESULT:\s*\S/.test(message);
}

/**
 * @typedef {object} StopSignals
 * @property {boolean} enabled       the --enforce-tests arg is present (opt-in; default off)
 * @property {unknown} agentType     input.agent_type from the SubagentStop payload
 * @property {unknown} lastMessage   the subagent's final assistant message text
 */

/**
 * Pure decision: block the SubagentStop ONLY when the gate is enabled, the stopping agent IS
 * ccf-implementer, AND its last message reports no TEST-RESULT evidence. Coerces untrusted/missing
 * input to a safe `false` — never throws.
 * @param {StopSignals} signals
 * @returns {boolean}
 */
export function shouldBlockImplementerStop(signals) {
  /** @type {any} */
  const s = signals && typeof signals === "object" ? signals : {};
  const enabled = Boolean(s.enabled);
  if (!enabled) return false;
  if (!isImplementer(s.agentType)) return false;
  return !implementerReportedTests(s.lastMessage);
}

/**
 * Resolve the subagent's final message text from a SubagentStop payload. Prefers the documented
 * field `last_assistant_message` (grounded via code.claude.com/docs/en/hooks + /sub-agents — the
 * ONLY message field SubagentStop's schema documents); falls back to `""` when absent so the caller
 * can try the transcript-based fallback instead. Coerces non-string input to "", never throws.
 * @param {unknown} input the raw SubagentStop stdin payload (or any object with that shape)
 * @returns {string}
 */
export function resolveLastMessage(input) {
  /** @type {any} */
  const i = input && typeof input === "object" ? input : {};
  return typeof i.last_assistant_message === "string" ? i.last_assistant_message : "";
}

/**
 * Extract the LAST assistant-role message's plain text from parsed transcript records (the same
 * `.jsonl` shape read elsewhere via `review-trace.mjs#parseJsonl`). Handles both a plain string
 * `message.content` and the array-of-blocks shape (`{type:"text", text:"..."}`), concatenating only
 * the text blocks. Best-effort: any unexpected shape/missing field is skipped, never throws;
 * no assistant record found → "".
 * @param {Array<Record<string, any>>} records parsed transcript records
 * @returns {string}
 */
export function extractLastAssistantText(records) {
  const list = Array.isArray(records) ? records : [];
  for (let i = list.length - 1; i >= 0; i--) {
    const r = list[i];
    if (!r || r.type !== "assistant") continue;
    const content = r.message?.content;
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
      const text = content
        .filter((block) => block && block.type === "text" && typeof block.text === "string")
        .map((block) => block.text)
        .join("\n");
      if (text) return text;
    }
  }
  return "";
}
