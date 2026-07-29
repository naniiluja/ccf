// Tests for lib/agent-match.mjs — matchesAgentName, the shared agent-name comparison predicate used
// by both implementer-verify.mjs#isImplementer and output-style.mjs#shouldInject.

import { test } from "node:test";
import assert from "node:assert/strict";
import { matchesAgentName } from "./agent-match.mjs";

test("matchesAgentName: exact tail match, case-insensitive", () => {
  assert.equal(matchesAgentName("ccf-implementer", "ccf-implementer"), true);
  assert.equal(matchesAgentName("CCF-Implementer", "ccf-implementer"), true);
});

test("matchesAgentName: namespace-prefixed tail (ns:name) still matches", () => {
  assert.equal(matchesAgentName("ccf:ccf-implementer", "ccf-implementer"), true);
});

test("matchesAgentName: does NOT loosely substring-match a different agent that merely contains the name", () => {
  assert.equal(matchesAgentName("ccf-implementer-helper", "ccf-implementer"), false);
});

test("matchesAgentName: false for a different/missing agentType", () => {
  assert.equal(matchesAgentName("ccf-spec-checker", "ccf-implementer"), false);
  assert.equal(matchesAgentName("", "ccf-implementer"), false);
  assert.equal(matchesAgentName(undefined, "ccf-implementer"), false);
  assert.equal(matchesAgentName(null, "ccf-implementer"), false);
  assert.equal(matchesAgentName(123, "ccf-implementer"), false);
});

// Regression guard (cc-2.1.220-realign correctness fix): the module header claims this function
// "never throws", but only agentType was coerced — a non-string `name` (the second parameter) threw
// a TypeError from `.toLowerCase()`. Not reached by any current call site (both pass a string
// literal), but the header's blanket claim must actually hold for BOTH parameters.
test("matchesAgentName: non-string `name` (second parameter) does not throw, returns false", () => {
  assert.doesNotThrow(() => {
    assert.equal(matchesAgentName("ccf-implementer", null), false);
    assert.equal(matchesAgentName("ccf-implementer", undefined), false);
    assert.equal(matchesAgentName("ccf-implementer", 123), false);
  });
});
