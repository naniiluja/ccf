// CCF agent-name matching — a tiny, neutral helper shared by two UNRELATED hook domains:
// implementer-verify.mjs (SubagentStop / --enforce-tests) and output-style.mjs (SubagentStart /
// rules injection). Moved here (task cc-2.1.220-realign) because it previously lived inside
// implementer-verify.mjs, which forced output-style.mjs to import FROM the SubagentStop gate's
// module even though it has nothing to do with that gate — a dependency direction that reads
// backwards to anyone who doesn't already know the history. A bare name-matching predicate has no
// natural home in either domain, so it lives at this shared infrastructure layer instead.

/**
 * Match an agent-type string against a known agent NAME, tolerant of the harness-observed `ns:name`
 * namespace prefix (e.g. `ccf:ccf-implementer`) and case. Compares the EXACT tail segment after the
 * LAST `:` against `name` — not a loose substring — so a hypothetical distinct agent whose name merely
 * CONTAINS `name` (e.g. a future `ccf-implementer-helper`) does not falsely match. Shared by
 * `implementer-verify.mjs#isImplementer` and `output-style.mjs#shouldInject` (both hooks needed the
 * exact same "is this agent type X" check; kept in one place per DRY — see
 * `.claude/rules/coding-conventions.md`). Coerces non-string input to "" so it never throws — for
 * BOTH parameters (cc-2.1.220-realign correctness fix: `name` was previously assumed to always be a
 * string literal since every current call site passes one, but the header's "never throws" claim
 * must actually hold regardless of what is passed).
 * @param {unknown} agentType the input.agent_type field from a SubagentStart/SubagentStop payload
 * @param {unknown} name the bare agent name to match against (e.g. "ccf-implementer")
 * @returns {boolean}
 */
export function matchesAgentName(agentType, name) {
  const type = typeof agentType === "string" ? agentType : "";
  if (!type) return false;
  const target = typeof name === "string" ? name : "";
  if (!target) return false;
  const tail = type.toLowerCase().split(":").pop() ?? "";
  return tail === target.toLowerCase();
}
