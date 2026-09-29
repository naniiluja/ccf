// Tests for lib/plan-trigger.mjs — node --test, no dependency.
// Covers the pure helpers behind the plan-skill-inject UserPromptSubmit hook:
//   shouldInjectPlanSkill — 5-input decision table (each input flipped once must change the result).
//   isCcfSlash            — only a LEADING `/ccf:` command counts.
//   hasPlanSkillRun       — role-gated transcript scan for "ccf:plan already ran this session".
//   planInjectMarkerPath  — per-session marker path, safe for any session_id text.
//   buildPlanSkillDirective — the injected text names the skill and the tool.

import { test } from "node:test";
import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import { dirname } from "node:path";
import {
  shouldInjectPlanSkill,
  isCcfSlash,
  hasPlanSkillRun,
  planInjectMarkerPath,
  buildPlanSkillDirective,
} from "./plan-trigger.mjs";

// The only combination that injects.
const ALL_ON = {
  mode: "plan",
  managed: true,
  isCcfSlash: false,
  alreadyInjected: false,
  skillAlreadyRan: false,
};

test("shouldInjectPlanSkill: all signals favorable → true", () => {
  assert.equal(shouldInjectPlanSkill(ALL_ON), true);
});

test("shouldInjectPlanSkill: not plan mode → false", () => {
  assert.equal(shouldInjectPlanSkill({ ...ALL_ON, mode: "default" }), false);
});

test("shouldInjectPlanSkill: mode must equal 'plan' exactly (no case folding, no substring)", () => {
  assert.equal(shouldInjectPlanSkill({ ...ALL_ON, mode: "PLAN" }), false);
  assert.equal(shouldInjectPlanSkill({ ...ALL_ON, mode: "planning" }), false);
});

test("shouldInjectPlanSkill: project not CCF-initialized → false", () => {
  assert.equal(shouldInjectPlanSkill({ ...ALL_ON, managed: false }), false);
});

test("shouldInjectPlanSkill: prompt is already a /ccf: command → false", () => {
  assert.equal(shouldInjectPlanSkill({ ...ALL_ON, isCcfSlash: true }), false);
});

test("shouldInjectPlanSkill: already injected this session → false", () => {
  assert.equal(shouldInjectPlanSkill({ ...ALL_ON, alreadyInjected: true }), false);
});

test("shouldInjectPlanSkill: ccf:plan already ran this session → false", () => {
  assert.equal(shouldInjectPlanSkill({ ...ALL_ON, skillAlreadyRan: true }), false);
});

test("shouldInjectPlanSkill: garbage input → false, never throws", () => {
  for (const bad of [undefined, null, {}, [], "plan", 42]) {
    // @ts-expect-error deliberately wrong types
    assert.equal(shouldInjectPlanSkill(bad), false);
  }
  // each negated flag must be the literal `false`: a missing signal is "do not nudge", not "nudge"
  for (const flag of ["isCcfSlash", "alreadyInjected", "skillAlreadyRan"]) {
    // @ts-expect-error deliberately missing/wrong types
    assert.equal(shouldInjectPlanSkill({ ...ALL_ON, [flag]: undefined }), false, `${flag}: undefined`);
    // @ts-expect-error deliberately wrong type
    assert.equal(shouldInjectPlanSkill({ ...ALL_ON, [flag]: 0 }), false, `${flag}: 0`);
  }
  // truthy-but-not-boolean flags must not count as true
  // @ts-expect-error deliberately wrong types
  assert.equal(shouldInjectPlanSkill({ ...ALL_ON, managed: "yes" }), false);
});

test("isCcfSlash: leading /ccf: command → true", () => {
  assert.equal(isCcfSlash("/ccf:plan add a feature"), true);
  assert.equal(isCcfSlash("  /ccf:check"), true);
});

test("isCcfSlash: built-in /plan, mid-prompt mention, non-string → false", () => {
  assert.equal(isCcfSlash("/plan add a feature"), false);
  assert.equal(isCcfSlash("please run /ccf:plan for me"), false);
  assert.equal(isCcfSlash(""), false);
  // @ts-expect-error deliberately wrong type
  assert.equal(isCcfSlash(undefined), false);
});

// ---- hasPlanSkillRun ----------------------------------------------------------------------

const skillCall = (skill, name = "Skill") => ({
  type: "assistant",
  message: { content: [{ type: "tool_use", name, input: { skill } }] },
});

test("hasPlanSkillRun: assistant Skill tool_use for ccf:plan → true", () => {
  assert.equal(hasPlanSkillRun([skillCall("ccf:plan")]), true);
});

test("hasPlanSkillRun: tool name is case-insensitive, bare 'plan' skill also counts", () => {
  assert.equal(hasPlanSkillRun([skillCall("ccf:plan", "skill")]), true);
  assert.equal(hasPlanSkillRun([skillCall("plan")]), true);
});

test("hasPlanSkillRun: a different skill → false", () => {
  assert.equal(hasPlanSkillRun([skillCall("ccf:check")]), false);
  assert.equal(hasPlanSkillRun([skillCall("ccf:grill-me")]), false);
});

test("hasPlanSkillRun: typed /ccf:plan (user record with the command-name tag) → true", () => {
  const asString = { type: "user", message: { content: "<command-name>/ccf:plan</command-name> x" } };
  const asBlocks = {
    type: "user",
    message: { content: [{ type: "text", text: "<command-name>/ccf:plan</command-name>" }] },
  };
  assert.equal(hasPlanSkillRun([asString]), true);
  assert.equal(hasPlanSkillRun([asBlocks]), true);
});

test("hasPlanSkillRun: role gate — assistant prose or a user-role tool_use never counts", () => {
  const assistantProse = {
    type: "assistant",
    message: { content: [{ type: "text", text: "<command-name>/ccf:plan</command-name>" }] },
  };
  const userToolUse = {
    type: "user",
    message: { content: [{ type: "tool_use", name: "Skill", input: { skill: "ccf:plan" } }] },
  };
  assert.equal(hasPlanSkillRun([assistantProse, userToolUse]), false);
});

test("hasPlanSkillRun: empty, malformed records, missing fields → false, never throws", () => {
  assert.equal(hasPlanSkillRun([]), false);
  assert.equal(hasPlanSkillRun([null, undefined, {}, { type: "assistant" }, { type: "user", message: 5 }]), false);
  // @ts-expect-error deliberately wrong type
  assert.equal(hasPlanSkillRun(undefined), false);
});

// ---- planInjectMarkerPath -----------------------------------------------------------------

test("planInjectMarkerPath: lives in the OS temp dir, one file per session", () => {
  const a = planInjectMarkerPath("abc-123");
  const b = planInjectMarkerPath("abc-124");
  assert.equal(dirname(a), tmpdir());
  assert.notEqual(a, b);
});

test("planInjectMarkerPath: hostile session_id cannot escape the temp dir", () => {
  const p = planInjectMarkerPath("../../etc/passwd");
  assert.equal(dirname(p), tmpdir());
  assert.ok(!p.includes(".."), "path separators and dots are stripped");
});

test("planInjectMarkerPath: empty or non-string session_id → null (no marker possible)", () => {
  assert.equal(planInjectMarkerPath(""), null);
  assert.equal(planInjectMarkerPath("///"), null);
  // @ts-expect-error deliberately wrong type
  assert.equal(planInjectMarkerPath(undefined), null);
});

// ---- buildPlanSkillDirective --------------------------------------------------------------

test("buildPlanSkillDirective: names the skill, the Skill tool, and the pure-question escape hatch", () => {
  const text = buildPlanSkillDirective();
  assert.match(text, /ccf:plan/);
  assert.match(text, /Skill tool/);
  assert.match(text, /only a question/i);
});
