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
