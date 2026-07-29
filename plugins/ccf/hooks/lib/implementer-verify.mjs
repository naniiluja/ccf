// CCF implementer-verify helpers — pure logic for the opt-in SubagentStop implementer-verify-gate.
// Decides whether a spawned ccf-implementer must be BLOCKED from stopping because its final message
// carries no TEST-RESULT evidence (per the pinned Return format in agents/ccf-implementer.md).
// Kept pure + defensive so it is unit-testable with `node --test` and never throws.
//
// Message resolution order: per changelog/docs at authoring time (task 034), the SubagentStop
// payload is expected to carry `last_assistant_message` — resolved by `resolveLastMessage` and used
// as the PRIMARY source. Whether `transcript_path` is ALSO present on this event, and whether
// `stop_hook_active` exists as a loop-guard signal, is NOT YET OBSERVED on a real harness payload
// (see project memory `subagentstop-shape-unconfirmed`; `034a` closed by user acceptance without a
// live observation). `extractLastAssistantText` remains a DEFENSIVE FALLBACK for the case
// `last_assistant_message` is absent/empty, reading `transcript_path` only if it is present at all.
//
// `stop_hook_active` tradeoff (task cc-2.1.220-realign — corrected to state BOTH failure directions,
// not just one): `shouldBlockImplementerStop` treats `stopHookActive === true` (strict boolean,
// never a truthy coercion) as "skip the block". The real SubagentStop shape of this field is STILL
// UNCONFIRMED (see project memory `subagentstop-shape-unconfirmed`; `034a` closed by user acceptance
// without a live observation), and it can fail in TWO opposite ways, not one:
//   - If `stop_hook_active` is simply ABSENT on the real payload and the implementer never manages to
//     add a `TEST-RESULT:` line, this gate has no retry counter at all — it blocks EVERY SubagentStop
//     for that run, i.e. it can loop INDEFINITELY, not just "fail safe toward blocking once".
//   - If the harness sets `stop_hook_active` to `true` already on the FIRST SubagentStop this gate
//     itself triggers (semantics unconfirmed for a child-scoped event), the gate lets that very first
//     re-entrant stop through with zero enforcement, even though `--enforce-tests` is on and no
//     TEST-RESULT evidence was ever reported.
// Neither direction is "safe" in the sense of matching the intended one-retry design — only real
// observation of a live payload can tell which (if either) actually happens. Do not read this gate
// as a hard guarantee that every implementer stop carries TEST-RESULT evidence, nor as a guarantee
// that it can never hang; it is a best-effort nudge whose retry behavior is unverified, matching the
// "advisory, not airtight" caution already accepted for auto-verify.mjs's `checkAlreadyRan` guard.
//
// `matchesAgentName` moved to lib/agent-match.mjs (task cc-2.1.220-realign): it is a neutral
// name-matching predicate with no real ties to the SubagentStop domain this file owns, and
// output-style.mjs (a different hook domain, SubagentStart) needed it too — importing FROM this
// file made that dependency read backwards. Re-used here for `isImplementer`.

import { matchesAgentName } from "./agent-match.mjs";

/**
 * Recognize the ccf-implementer agent type, defensively (harness-dependent casing/namespace prefix).
 * Coerces non-string input to "" so it never throws. Empty/missing → false.
 * @param {unknown} agentType the input.agent_type field from a SubagentStop payload
 * @returns {boolean}
 */
export function isImplementer(agentType) {
  return matchesAgentName(agentType, "ccf-implementer");
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
  // Anchored at the START of a line (leading whitespace allowed), per the pinned Return-format
  // convention in agents/ccf-implementer.md ("Pin the LAST line of your response to exactly one
  // of..."). Without the `^`/`m` anchor, a mid-sentence PROMISE like "I will add a TEST-RESULT: line
  // later" also matched (cc-2.1.220-realign correctness fix) — a hollow phrase, not real evidence.
  return /^\s*TEST-RESULT:\s*\S/m.test(message);
}

/**
 * @typedef {object} StopSignals
 * @property {boolean} enabled          the --enforce-tests arg is present (opt-in; default off)
 * @property {boolean} [stopHookActive] input.stop_hook_active — true when this is a re-entrant
 *                                       SubagentStop already driven by this same gate (ASK-ONCE loop
 *                                       guard, not a cumulative-enforcement guarantee — see the
 *                                       module-level tradeoff note above). Absent/non-boolean coerces
 *                                       to false, so omitting it keeps the pre-existing behavior
 *                                       unchanged.
 * @property {unknown} agentType        input.agent_type from the SubagentStop payload
 * @property {unknown} lastMessage      the subagent's final assistant message text
 */

/**
 * Pure decision: block the SubagentStop ONLY when the gate is enabled, this is NOT a re-entrant
 * stop (stopHookActive guards against re-blocking the same drive in a loop), the stopping agent IS
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
  // Strict boolean check (cc-2.1.220-realign correctness fix): the real SubagentStop shape of this
  // field is UNCONFIRMED (see the module-level tradeoff note above), and `Boolean(s.stopHookActive)`
  // treated ANY truthy value — including the STRING "false", which a harness could plausibly emit —
  // as "skip the block", silently disabling enforcement. Only the real boolean `true` may act as the
  // loop guard; every other value (a string, a number, null, undefined) is treated as "not active".
  if (s.stopHookActive === true) return false;
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
