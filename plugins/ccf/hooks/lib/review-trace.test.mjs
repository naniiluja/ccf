// Tests for lib/review-trace.mjs — node --test, no dependency.
// Guards the plan-review-gate decision: detect a /ccf:plan session and a ccf-spec-checker review.

import { test } from "node:test";
import assert from "node:assert/strict";
import { parseJsonl, hasCcfPlanCommand, hasSpecCheckerReview } from "./review-trace.mjs";

const userPlan = JSON.stringify({ type: "user", message: { content: "please run /ccf:plan now" } });
// Bare `/plan` is Claude Code's BUILT-IN plan command (NOT CCF's `/ccf:plan`) — must NOT match.
const userBuiltinPlan = JSON.stringify({ type: "user", message: { content: [{ type: "text", text: "/plan add auth" }] } });
// Namespaced form inside a content-block array (harness shape) — must match.
const userPlanBlock = JSON.stringify({ type: "user", message: { content: [{ type: "text", text: "/ccf:plan add auth" }] } });
const userOther = JSON.stringify({ type: "user", message: { content: "just chatting" } });
const specCheckerTask = JSON.stringify({
  type: "assistant",
  message: { content: [{ type: "tool_use", name: "Task", input: { subagent_type: "ccf-spec-checker", prompt: "review" } }] },
});
const otherTask = JSON.stringify({
  type: "assistant",
  message: { content: [{ type: "tool_use", name: "Task", input: { subagent_type: "Explore" } }] },
});
// This harness spawns subagents via a tool named "Agent" (not "Task") and the
// subagent_type carries the plugin namespace ("ccf:ccf-spec-checker").
const specCheckerAgent = JSON.stringify({
  type: "assistant",
  message: { content: [{ type: "tool_use", name: "Agent", input: { subagent_type: "ccf:ccf-spec-checker", prompt: "review" } }] },
});
const specCheckerAgentLower = JSON.stringify({
  type: "assistant",
  message: { content: [{ type: "tool_use", name: "agent", input: { subagent_type: "ccf-spec-checker" } }] },
});
const implementerAgent = JSON.stringify({
  type: "assistant",
  message: { content: [{ type: "tool_use", name: "Agent", input: { subagent_type: "ccf-implementer" } }] },
});
const namelessBlock = JSON.stringify({
  type: "assistant",
  message: { content: [{ type: "tool_use", input: { subagent_type: "ccf-spec-checker" } }] },
});

test("parseJsonl: parses lines and skips blank/corrupt ones", () => {
  const raw = [userPlan, "", "{ not json", specCheckerTask].join("\n");
  const records = parseJsonl(raw);
  assert.equal(records.length, 2);
});

test("parseJsonl: empty/garbage input → empty array, never throws", () => {
  assert.deepEqual(parseJsonl(""), []);
  // @ts-expect-error testing untrusted input
  assert.deepEqual(parseJsonl(null), []);
});

test("hasCcfPlanCommand: true for the namespaced /ccf:plan form (string + block shapes)", () => {
  assert.equal(hasCcfPlanCommand(parseJsonl(userPlan)), true);
  assert.equal(hasCcfPlanCommand(parseJsonl(userPlanBlock)), true);
});

test("hasCcfPlanCommand: false for the built-in bare /plan (not CCF's command)", () => {
  assert.equal(hasCcfPlanCommand(parseJsonl(userBuiltinPlan)), false);
});

test("hasCcfPlanCommand: false when no /ccf:plan in any user line", () => {
  assert.equal(hasCcfPlanCommand(parseJsonl([userOther, specCheckerTask].join("\n"))), false);
});

test("hasSpecCheckerReview: true when a Task delegates to ccf-spec-checker", () => {
  assert.equal(hasSpecCheckerReview(parseJsonl([userPlan, specCheckerTask].join("\n"))), true);
});

test("hasSpecCheckerReview: true when an Agent-named tool delegates to ccf-spec-checker (the deadlock bug)", () => {
  // Failing-first: before the fix this returns false because name !== "Task",
  // deadlocking the plan-review-gate in harnesses that spawn via "Agent".
  assert.equal(hasSpecCheckerReview(parseJsonl([userPlan, specCheckerAgent].join("\n"))), true);
});

test("hasSpecCheckerReview: case-insensitive on the spawn tool name (lowercase 'agent')", () => {
  assert.equal(hasSpecCheckerReview(parseJsonl([userPlan, specCheckerAgentLower].join("\n"))), true);
});

test("hasSpecCheckerReview: false for a different subagent", () => {
  assert.equal(hasSpecCheckerReview(parseJsonl([userPlan, otherTask].join("\n"))), false);
});

test("hasSpecCheckerReview: false for an Agent spawning a non-spec-checker subagent", () => {
  assert.equal(hasSpecCheckerReview(parseJsonl([userPlan, implementerAgent].join("\n"))), false);
});

test("hasSpecCheckerReview: false (no throw) when a tool_use block has no name", () => {
  assert.equal(hasSpecCheckerReview(parseJsonl([userPlan, namelessBlock].join("\n"))), false);
});

test("hasSpecCheckerReview: false when there is no Task tool_use at all", () => {
  assert.equal(hasSpecCheckerReview(parseJsonl([userPlan, userOther].join("\n"))), false);
});

test("gate logic: plan session without review → should deny (command true, review false)", () => {
  const records = parseJsonl([userPlan, userOther].join("\n"));
  assert.equal(hasCcfPlanCommand(records) && !hasSpecCheckerReview(records), true);
});

test("gate logic: plan session with review → should allow", () => {
  const records = parseJsonl([userPlan, specCheckerTask].join("\n"));
  assert.equal(hasCcfPlanCommand(records) && !hasSpecCheckerReview(records), false);
});
