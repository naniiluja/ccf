// Tests for lib/review-trace.mjs — node --test, no dependency.
// Guards the auto-verify Stop hook's cross-Stop guard: detect a ccf-spec-checker review this session.

import { test } from "node:test";
import assert from "node:assert/strict";
import { parseJsonl, hasSpecCheckerSpawn } from "./review-trace.mjs";

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
const namelessBlock = JSON.stringify({
  type: "assistant",
  message: { content: [{ type: "tool_use", input: { subagent_type: "ccf-spec-checker" } }] },
});

test("parseJsonl: parses lines and skips blank/corrupt ones", () => {
  const raw = [userOther, "", "{ not json", specCheckerTask].join("\n");
  const records = parseJsonl(raw);
  assert.equal(records.length, 2);
});

test("parseJsonl: empty/garbage input → empty array, never throws", () => {
  assert.deepEqual(parseJsonl(""), []);
  // @ts-expect-error testing untrusted input
  assert.deepEqual(parseJsonl(null), []);
});

test("hasSpecCheckerSpawn: true when a Task delegates to ccf-spec-checker", () => {
  assert.equal(hasSpecCheckerSpawn(parseJsonl([userOther, specCheckerTask].join("\n"))), true);
});

test("hasSpecCheckerSpawn: true when an Agent-named tool delegates to ccf-spec-checker (the deadlock bug)", () => {
  // Failing-first: before the fix this returns false because name !== "Task", which would
  // silently disable the auto-verify cross-Stop guard in harnesses that spawn via "Agent".
  assert.equal(hasSpecCheckerSpawn(parseJsonl([userOther, specCheckerAgent].join("\n"))), true);
});

test("hasSpecCheckerSpawn: case-insensitive on the spawn tool name (lowercase 'agent')", () => {
  assert.equal(hasSpecCheckerSpawn(parseJsonl([userOther, specCheckerAgentLower].join("\n"))), true);
});

test("hasSpecCheckerSpawn: false for a different subagent", () => {
  assert.equal(hasSpecCheckerSpawn(parseJsonl([userOther, otherTask].join("\n"))), false);
});

test("hasSpecCheckerSpawn: false (no throw) when a tool_use block has no name", () => {
  assert.equal(hasSpecCheckerSpawn(parseJsonl([userOther, namelessBlock].join("\n"))), false);
});

test("hasSpecCheckerSpawn: false when there is no Task tool_use at all", () => {
  assert.equal(hasSpecCheckerSpawn(parseJsonl([userOther, userOther].join("\n"))), false);
});
