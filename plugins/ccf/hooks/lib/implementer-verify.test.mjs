// Tests for implementer-verify.mjs — pure decision logic for the SubagentStop implementer-verify-gate.
// EP (equivalence partitioning) over the three inputs of shouldBlockImplementerStop:
//   enabled (opt-in flag), agentType (harness-dependent string), lastMessage (assistant's final text).

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isImplementer,
  implementerReportedTests,
  shouldBlockImplementerStop,
  resolveLastMessage,
  extractLastAssistantText,
} from "./implementer-verify.mjs";

test("isImplementer: recognizes ccf-implementer (defensive substring match)", () => {
  assert.equal(isImplementer("ccf-implementer"), true);
  assert.equal(isImplementer("CCF-Implementer"), true); // harness may vary case
});

test("isImplementer: false for a different/missing agent type", () => {
  assert.equal(isImplementer("ccf-spec-checker"), false);
  assert.equal(isImplementer(""), false);
  assert.equal(isImplementer(undefined), false);
  assert.equal(isImplementer(null), false);
  assert.equal(isImplementer(123), false);
});

test("implementerReportedTests: true when a TEST-RESULT: line with a real result is present", () => {
  assert.equal(
    implementerReportedTests("Summary...\nTEST-RESULT: node --test → 5 passed, 0 failed"),
    true,
  );
});

test("implementerReportedTests: true for the prose-only n/a declaration", () => {
  assert.equal(implementerReportedTests("All done.\nTEST-RESULT: n/a (no test surface)"), true);
});

test("implementerReportedTests: false when there is no TEST-RESULT evidence", () => {
  assert.equal(implementerReportedTests("I finished the task, all good."), false);
});

test("implementerReportedTests: false/no-throw on garbage input", () => {
  assert.equal(implementerReportedTests(""), false);
  assert.equal(implementerReportedTests(undefined), false);
  assert.equal(implementerReportedTests(null), false);
  assert.equal(implementerReportedTests(42), false);
});

test("shouldBlockImplementerStop: opt-in off → false even with missing evidence", () => {
  assert.equal(
    shouldBlockImplementerStop({ enabled: false, agentType: "ccf-implementer", lastMessage: "done" }),
    false,
  );
});

test("shouldBlockImplementerStop: non-implementer agent → false even with missing evidence", () => {
  assert.equal(
    shouldBlockImplementerStop({ enabled: true, agentType: "ccf-spec-checker", lastMessage: "done" }),
    false,
  );
});

test("shouldBlockImplementerStop: implementer + missing evidence + enabled → true (BLOCK)", () => {
  assert.equal(
    shouldBlockImplementerStop({ enabled: true, agentType: "ccf-implementer", lastMessage: "All done." }),
    true,
  );
});

test("shouldBlockImplementerStop: implementer + TEST-RESULT present → false (allow stop)", () => {
  assert.equal(
    shouldBlockImplementerStop({
      enabled: true,
      agentType: "ccf-implementer",
      lastMessage: "Summary...\nTEST-RESULT: node --test → 5 passed, 0 failed",
    }),
    false,
  );
});

test("shouldBlockImplementerStop: implementer + TEST-RESULT n/a → false (allow stop, prose-only valid)", () => {
  assert.equal(
    shouldBlockImplementerStop({
      enabled: true,
      agentType: "ccf-implementer",
      lastMessage: "Prose-only task, nothing to test.\nTEST-RESULT: n/a (no test surface)",
    }),
    false,
  );
});

test("shouldBlockImplementerStop: garbage input → false, never throws", () => {
  assert.doesNotThrow(() => {
    assert.equal(shouldBlockImplementerStop(undefined), false);
    assert.equal(shouldBlockImplementerStop(null), false);
    assert.equal(shouldBlockImplementerStop({}), false);
    assert.equal(shouldBlockImplementerStop("not an object"), false);
  });
});

test("resolveLastMessage: reads the documented last_assistant_message field", () => {
  assert.equal(
    resolveLastMessage({ last_assistant_message: "TEST-RESULT: node --test → 5 passed, 0 failed" }),
    "TEST-RESULT: node --test → 5 passed, 0 failed",
  );
});

test("resolveLastMessage: \"\" when the field is absent/wrong-type, never throws", () => {
  assert.equal(resolveLastMessage({}), "");
  assert.equal(resolveLastMessage({ last_assistant_message: 42 }), "");
  assert.equal(resolveLastMessage(undefined), "");
  assert.equal(resolveLastMessage(null), "");
  assert.equal(resolveLastMessage("not an object"), "");
});

test(
  "field precedence: shouldBlockImplementerStop allows a stop when last_assistant_message alone " +
    "(no transcript_path in the payload) carries TEST-RESULT evidence",
  () => {
    const payload = {
      agent_type: "ccf-implementer",
      last_assistant_message: "Done.\nTEST-RESULT: node --test → 5 passed, 0 failed",
    };
    // Mirrors what the hook does: resolve the message from the payload FIRST, no transcript fallback.
    const lastMessage = resolveLastMessage(payload);
    assert.equal(
      shouldBlockImplementerStop({ enabled: true, agentType: payload.agent_type, lastMessage }),
      false,
    );
  },
);

test(
  "field precedence: shouldBlockImplementerStop blocks a stop when last_assistant_message alone " +
    "(no transcript_path) carries no evidence",
  () => {
    const payload = { agent_type: "ccf-implementer", last_assistant_message: "All done, no tests." };
    const lastMessage = resolveLastMessage(payload);
    assert.equal(
      shouldBlockImplementerStop({ enabled: true, agentType: payload.agent_type, lastMessage }),
      true,
    );
  },
);

test("extractLastAssistantText: reads a string message.content", () => {
  const records = [
    { type: "user", message: { content: "do the task" } },
    { type: "assistant", message: { content: "TEST-RESULT: n/a (no test surface)" } },
  ];
  assert.equal(extractLastAssistantText(records), "TEST-RESULT: n/a (no test surface)");
});

test("extractLastAssistantText: reads the LAST assistant record, joining text blocks", () => {
  const records = [
    { type: "assistant", message: { content: [{ type: "text", text: "first turn" }] } },
    { type: "user", message: { content: "continue" } },
    {
      type: "assistant",
      message: {
        content: [
          { type: "text", text: "Summary line." },
          { type: "tool_use", name: "Bash" },
          { type: "text", text: "TEST-RESULT: node --test → 5 passed, 0 failed" },
        ],
      },
    },
  ];
  assert.equal(
    extractLastAssistantText(records),
    "Summary line.\nTEST-RESULT: node --test → 5 passed, 0 failed",
  );
});

test("extractLastAssistantText: no assistant record / garbage → \"\", never throws", () => {
  assert.equal(extractLastAssistantText([]), "");
  assert.equal(extractLastAssistantText(undefined), "");
  assert.equal(extractLastAssistantText(null), "");
  assert.equal(extractLastAssistantText([{ type: "user", message: {} }]), "");
});

// Fixture-real placeholder: task 034 acknowledges SubagentStop's transcript/loop-guard shape is
// UNCONFIRMED by docs. This fixture will be filled in after 034a's live observation (a real
// SubagentStop stdin payload captured on the user's harness), matching the freshness.md pattern
// of a deliberate hanging live-verify follow-up. For now it only asserts the function is pure/stable
// against a minimal shape resembling the documented SubagentStop input.
test("shouldBlockImplementerStop: fixture placeholder — minimal documented-shape input (filled in 034a)", () => {
  const minimalInput = { enabled: true, agentType: "ccf-implementer", lastMessage: "" };
  assert.equal(shouldBlockImplementerStop(minimalInput), true);
});
