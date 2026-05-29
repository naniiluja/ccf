// Tests for lib/freshness.mjs — node --test, no dependency.
// Guards the pure decision core `decideFreshness`: git committer-time is the primary
// signal; mtime is the fallback whenever git can't answer for EITHER side (null).
// Written failing-first per the CCF workflow.

import { test } from "node:test";
import assert from "node:assert/strict";
import { decideFreshness } from "./freshness.mjs";

// --- (codeGit, specGit) both resolve → git-time path ---

test("git-time: code newer than spec → true", () => {
  assert.equal(
    decideFreshness({ codeGit: 200, specGit: 100, codeMtime: 0, specMtime: 0 }),
    true,
  );
});

test("git-time: equal → false (THE bug case — same commit must not nudge)", () => {
  assert.equal(
    decideFreshness({ codeGit: 100, specGit: 100, codeMtime: 999, specMtime: 0 }),
    false,
  );
});

test("git-time: spec newer than code → false", () => {
  assert.equal(
    decideFreshness({ codeGit: 100, specGit: 200, codeMtime: 999, specMtime: 0 }),
    false,
  );
});

// --- (number, null): spec uncommitted → fall back to mtime ---

test("(number,null): falls back to mtime, code mtime newer → true", () => {
  assert.equal(
    decideFreshness({ codeGit: 100, specGit: null, codeMtime: 200, specMtime: 100 }),
    true,
  );
});

test("(number,null): falls back to mtime, spec mtime newer → false", () => {
  assert.equal(
    decideFreshness({ codeGit: 100, specGit: null, codeMtime: 100, specMtime: 200 }),
    false,
  );
});

// --- (null, number): code uncommitted → fall back to mtime ---

test("(null,number): falls back to mtime (no crash on null git), code mtime newer → true", () => {
  assert.equal(
    decideFreshness({ codeGit: null, specGit: 100, codeMtime: 200, specMtime: 100 }),
    true,
  );
});

// --- (null, null): not a git repo → fall back to mtime ---

test("(null,null): not a git repo → falls back to mtime, code mtime newer → true", () => {
  assert.equal(
    decideFreshness({ codeGit: null, specGit: null, codeMtime: 200, specMtime: 100 }),
    true,
  );
});

test("(null,null): not a git repo → falls back to mtime, equal mtime → false", () => {
  assert.equal(
    decideFreshness({ codeGit: null, specGit: null, codeMtime: 100, specMtime: 100 }),
    false,
  );
});
