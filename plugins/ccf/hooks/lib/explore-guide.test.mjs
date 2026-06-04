// Tests for explore-guide.mjs — pure content lib for the explore-guide-inject SubagentStart hook.
// Run: node --test plugins/ccf/hooks/lib/explore-guide.test.mjs

import test from "node:test";
import assert from "node:assert/strict";

import { buildExploreGuidance } from "./explore-guide.mjs";

test("buildExploreGuidance — returns a non-empty string", () => {
  const text = buildExploreGuidance();
  assert.equal(typeof text, "string");
  assert.ok(text.trim().length > 0);
});

test("buildExploreGuidance — bounded to <= ~8 non-blank lines", () => {
  const nonBlank = buildExploreGuidance()
    .split("\n")
    .filter((l) => l.trim().length > 0);
  assert.ok(nonBlank.length <= 8, `expected <= 8 non-blank lines, got ${nonBlank.length}`);
});

test("buildExploreGuidance — mentions the four LSP operations", () => {
  const text = buildExploreGuidance();
  for (const op of ["workspaceSymbol", "goToDefinition", "findReferences", "documentSymbol"]) {
    assert.match(text, new RegExp(op), `missing LSP op ${op}`);
  }
});

test("buildExploreGuidance — mentions Grep, ripgrep and Glob", () => {
  const text = buildExploreGuidance();
  assert.match(text, /Grep/);
  assert.match(text, /ripgrep/);
  assert.match(text, /Glob/);
});

test("buildExploreGuidance — keeps the literal no-retry guard", () => {
  // premortem L: the LSP tool is inactive without a language server; the directive must tell
  // Explore to fall back rather than retry, in the EXACT words so docs/grep stay aligned.
  assert.match(buildExploreGuidance(), /don't retry/);
});

// Matcher-key evidence (premortem M, [[subagent-spawn-tool-named-agent]]):
// No real SubagentStart hook-input line carrying `agent_type` was found in the local
// transcripts at task 025 time → the matcher key "Explore" is EVIDENCE-PENDING (025a must
// capture it). When a fixture is available, add it here and assert matcher === observed agent_type.
