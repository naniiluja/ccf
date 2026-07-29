// Tests for output-style.mjs — pure decision lib for the agent-rules-inject SubagentStart hook.
// Run: node --test plugins/ccf/hooks/lib/output-style.test.mjs

import test from "node:test";
import assert from "node:assert/strict";

import {
  shouldInject,
  resolveActiveOutputStyle,
  buildInjectDirective,
  WRITER_AGENTS,
} from "./output-style.mjs";

test("WRITER_AGENTS is the allowlist of file-writing agents", () => {
  assert.ok(WRITER_AGENTS instanceof Set);
  assert.equal(WRITER_AGENTS.has("ccf-implementer"), true);
});

test("shouldInject — writer agent → true", () => {
  assert.equal(shouldInject("ccf-implementer"), true);
});

test("shouldInject — non-writer agent → false", () => {
  assert.equal(shouldInject("ccf-spec-checker"), false);
  assert.equal(shouldInject("ccf-codebase-analyzer"), false);
  assert.equal(shouldInject("general-purpose"), false);
});

test("shouldInject — empty string → false", () => {
  assert.equal(shouldInject(""), false);
});

test("shouldInject — undefined → false", () => {
  assert.equal(shouldInject(undefined), false);
});

test("shouldInject — real call-site prefixed form (ccf:ccf-implementer) → true", () => {
  // Live observation (39/39 async-agent ack strings at the call site) showed the agent name
  // reaching hooks carries a `ccf:` namespace prefix, never the bare unprefixed literal — an
  // exact-equality match against WRITER_AGENTS would silently never fire on the real shape.
  assert.equal(shouldInject("ccf:ccf-implementer"), true);
});

test("shouldInject — prefixed read-only agent (ccf:ccf-spec-checker) → false", () => {
  assert.equal(shouldInject("ccf:ccf-spec-checker"), false);
});

test("shouldInject — case-insensitive match (CCF:CCF-IMPLEMENTER) → true", () => {
  assert.equal(shouldInject("CCF:CCF-IMPLEMENTER"), true);
});

test("shouldInject — a FUTURE distinct agent whose name merely CONTAINS the writer name → false", () => {
  // Regression guard (task cc-2.1.220-realign): shouldInject must match the agent-type TAIL exactly
  // (after splitting on ":"), not a loose substring — a hypothetical "ccf-implementer-helper"
  // read-only agent must NOT be treated as the writer, or it would receive a "self-check and fix any
  // violation" directive that contradicts its read-only mandate and wastes context.
  assert.equal(shouldInject("ccf-implementer-helper"), false);
  assert.equal(shouldInject("ccf:ccf-implementer-helper"), false);
});

test("resolveActiveOutputStyle — no settings layers → null", () => {
  const got = resolveActiveOutputStyle({
    settingsLayers: [],
    projectStyleFiles: {},
    userStyleFiles: {},
  });
  assert.equal(got, null);
});

test("resolveActiveOutputStyle — no outputStyle key anywhere → null", () => {
  const got = resolveActiveOutputStyle({
    settingsLayers: [{}, { foo: "bar" }],
    projectStyleFiles: { Terse: "/p/Terse.md" },
    userStyleFiles: {},
  });
  assert.equal(got, null);
});

test("resolveActiveOutputStyle — malformed (non-object) layer is skipped → null", () => {
  const got = resolveActiveOutputStyle({
    settingsLayers: [null, "broken", 42, undefined],
    projectStyleFiles: {},
    userStyleFiles: {},
  });
  assert.equal(got, null);
});

test("resolveActiveOutputStyle — built-in style (no matching file) → name set, path null", () => {
  const got = resolveActiveOutputStyle({
    settingsLayers: [{ outputStyle: "Explanatory" }],
    projectStyleFiles: {},
    userStyleFiles: {},
  });
  assert.deepEqual(got, { name: "Explanatory", path: null });
});

test("resolveActiveOutputStyle — custom project style resolves to its file path", () => {
  const got = resolveActiveOutputStyle({
    settingsLayers: [{ outputStyle: "Terse" }],
    projectStyleFiles: { Terse: "/proj/.claude/output-styles/Terse.md" },
    userStyleFiles: {},
  });
  assert.deepEqual(got, {
    name: "Terse",
    path: "/proj/.claude/output-styles/Terse.md",
  });
});

test("resolveActiveOutputStyle — custom user style resolves when project has none", () => {
  const got = resolveActiveOutputStyle({
    settingsLayers: [{ outputStyle: "MyStyle" }],
    projectStyleFiles: {},
    userStyleFiles: { MyStyle: "/home/u/.claude/output-styles/MyStyle.md" },
  });
  assert.deepEqual(got, {
    name: "MyStyle",
    path: "/home/u/.claude/output-styles/MyStyle.md",
  });
});

test("resolveActiveOutputStyle — project style file wins over a same-name user file", () => {
  const got = resolveActiveOutputStyle({
    settingsLayers: [{ outputStyle: "Shared" }],
    projectStyleFiles: { Shared: "/proj/.claude/output-styles/Shared.md" },
    userStyleFiles: { Shared: "/home/u/.claude/output-styles/Shared.md" },
  });
  assert.deepEqual(got, {
    name: "Shared",
    path: "/proj/.claude/output-styles/Shared.md",
  });
});

test("resolveActiveOutputStyle — earlier settings layer (project.local) wins over later (user)", () => {
  // settingsLayers ordered most-specific-first: project.local > project > user.
  const got = resolveActiveOutputStyle({
    settingsLayers: [
      { outputStyle: "Local" },
      { outputStyle: "ProjectWide" },
      { outputStyle: "UserDefault" },
    ],
    projectStyleFiles: {
      Local: "/proj/.claude/output-styles/Local.md",
      ProjectWide: "/proj/.claude/output-styles/ProjectWide.md",
    },
    userStyleFiles: {},
  });
  assert.deepEqual(got, {
    name: "Local",
    path: "/proj/.claude/output-styles/Local.md",
  });
});

test("resolveActiveOutputStyle — a layer with empty/blank outputStyle is skipped, next layer used", () => {
  const got = resolveActiveOutputStyle({
    settingsLayers: [{ outputStyle: "" }, { outputStyle: "  " }, { outputStyle: "Real" }],
    projectStyleFiles: { Real: "/p/Real.md" },
    userStyleFiles: {},
  });
  assert.deepEqual(got, { name: "Real", path: "/p/Real.md" });
});

test("resolveActiveOutputStyle — non-string outputStyle value is ignored → null", () => {
  const got = resolveActiveOutputStyle({
    settingsLayers: [{ outputStyle: 123 }, { outputStyle: { x: 1 } }],
    projectStyleFiles: {},
    userStyleFiles: {},
  });
  assert.equal(got, null);
});

test("buildInjectDirective — without a style path: always references .claude/rules", () => {
  const d = buildInjectDirective(null);
  assert.equal(typeof d, "string");
  assert.ok(d.includes(".claude/rules"), "must point to .claude/rules");
});

test("buildInjectDirective — with a style path: references the path + a persona-exclusion phrase", () => {
  const p = "/proj/.claude/output-styles/Terse.md";
  const d = buildInjectDirective(p);
  assert.ok(d.includes(".claude/rules"), "must still reference .claude/rules");
  assert.ok(d.includes(p), "must reference the resolved style path");
  // Excludes persona/tone/narration/emoji/roleplay — assert the exclusion is stated.
  assert.match(d, /persona|tone|narration|emoji|roleplay/i);
});

test("buildInjectDirective — instructs a self-check and stays short (<= ~8 lines)", () => {
  const d = buildInjectDirective("/p/S.md");
  assert.match(d, /self-check|verify|confirm|re-?read|check/i);
  const lines = d.split(/\r?\n/).filter((l) => l.trim() !== "");
  assert.ok(lines.length <= 8, `directive too long: ${lines.length} non-empty lines`);
});
