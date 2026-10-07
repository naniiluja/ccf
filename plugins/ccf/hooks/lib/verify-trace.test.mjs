// Tests for lib/verify-trace.mjs — node --test, no dependency.
// Guards the verify-work Stop nudge decision: this SESSION edited code but ran no test command.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  needsVerifyNudge,
  isCodeFile,
  isTestCommand,
  editedAnyCodeFile,
  readTranscriptSignals,
} from "./verify-trace.mjs";

// --- pure decision: needsVerifyNudge ---

test("needsVerifyNudge: edited code + no tests ran → nudge", () => {
  assert.equal(needsVerifyNudge({ editedCode: true, ranTests: false }), true);
});

test("needsVerifyNudge: edited code + tests ran → no nudge", () => {
  assert.equal(needsVerifyNudge({ editedCode: true, ranTests: true }), false);
});

test("needsVerifyNudge: no code edited → no nudge (even if no tests)", () => {
  assert.equal(needsVerifyNudge({ editedCode: false, ranTests: false }), false);
});

test("needsVerifyNudge: no code edited + tests ran → no nudge", () => {
  assert.equal(needsVerifyNudge({ editedCode: false, ranTests: true }), false);
});

test("needsVerifyNudge: missing/undefined fields → no nudge, never throws", () => {
  // @ts-expect-error testing untrusted input
  assert.equal(needsVerifyNudge({}), false);
  // @ts-expect-error testing untrusted input
  assert.equal(needsVerifyNudge(null), false);
  // @ts-expect-error testing untrusted input
  assert.equal(needsVerifyNudge(undefined), false);
});

// --- isCodeFile ---

test("isCodeFile: true for code extensions", () => {
  assert.equal(isCodeFile("src/app.ts"), true);
  assert.equal(isCodeFile("hooks/x.mjs"), true);
  assert.equal(isCodeFile("a/b/c.py"), true);
  assert.equal(isCodeFile("Main.java"), true);
});

test("isCodeFile: false for non-code / markdown / missing", () => {
  assert.equal(isCodeFile("README.md"), false);
  assert.equal(isCodeFile(".claude/rules/hooks.md"), false);
  assert.equal(isCodeFile("notes.txt"), false);
  // @ts-expect-error testing untrusted input
  assert.equal(isCodeFile(null), false);
  // @ts-expect-error testing untrusted input
  assert.equal(isCodeFile(undefined), false);
});

// --- isTestCommand ---

test("isTestCommand: true for common test runners", () => {
  assert.equal(isTestCommand("node --test plugins/ccf/hooks/lib/*.test.mjs"), true);
  assert.equal(isTestCommand("npm test"), true);
  assert.equal(isTestCommand("npm run test"), true);
  assert.equal(isTestCommand("npx vitest run"), true);
  assert.equal(isTestCommand("pytest -q"), true);
  assert.equal(isTestCommand("go test ./..."), true);
  assert.equal(isTestCommand("npx -p typescript tsc --noEmit"), true);
});

test("isTestCommand: true for every real runner invocation", () => {
  for (const cmd of [
    "yarn test",
    "pnpm test",
    "pnpm run test",
    "tsc --noEmit",
    "npx tsc --noEmit",
    "node /Users/me/.npm/_npx/abc/node_modules/typescript/bin/tsc --noEmit",
    "node node_modules/jest/bin/jest.js",
    "cargo test",
    "jest",
    "mocha",
    "phpunit",
    "rspec",
    "python3 -m pytest -q",
    "pnpm dlx vitest run",
    "bunx vitest",
    "CI=1 npm test",
    "npx tsc && echo done",
    "cd plugins/ccf && npm test",
    "rm -rf build; node --test a.test.mjs",
    "node_modules/.bin/tsc --noEmit",
    "C:\\proj\\node_modules\\.bin\\tsc.cmd --noEmit",
  ]) {
    assert.equal(isTestCommand(cmd), true, cmd);
  }
});

test("isTestCommand: false when a runner name is only mentioned, not executed", () => {
  for (const cmd of [
    'git commit -m "fix tsc exit code"',
    "grep -rn tsc plugins/",
    "cat notes.md about jest setup",
    "git checkout -b feature/tsc",
    "ls node_modules/.bin/tsc",
    "echo vitest",
    "echo pytest is great",
    "grep -r jest package.json",
    "cat tests/pytest.ini",
    'git commit -m "run npm test && tsc"',
    "rm -rf build && npm run build",
    "npm run build",
    "node script.mjs --tsc",
    "git log --grep=jest",
    "cargo build",
    "go build ./...",
  ]) {
    assert.equal(isTestCommand(cmd), false, cmd);
  }
});

test("isTestCommand: false for non-test commands / missing", () => {
  assert.equal(isTestCommand("ls -la"), false);
  assert.equal(isTestCommand("git status"), false);
  // @ts-expect-error testing untrusted input
  assert.equal(isTestCommand(null), false);
  // @ts-expect-error testing untrusted input
  assert.equal(isTestCommand(undefined), false);
});

// --- editedAnyCodeFile (MultiEdit shape tolerance) ---

test("editedAnyCodeFile: top-level file_path (Write/Edit)", () => {
  assert.equal(editedAnyCodeFile({ file_path: "src/app.ts" }), true);
  assert.equal(editedAnyCodeFile({ file_path: "README.md" }), false);
});

test("editedAnyCodeFile: edits[] array (one MultiEdit shape)", () => {
  assert.equal(editedAnyCodeFile({ edits: [{ file_path: "a.md" }, { file_path: "b.mjs" }] }), true);
  assert.equal(editedAnyCodeFile({ edits: [{ file_path: "a.md" }] }), false);
});

test("editedAnyCodeFile: file_paths[] array (another shape)", () => {
  assert.equal(editedAnyCodeFile({ file_paths: ["docs.md", "x.py"] }), true);
  assert.equal(editedAnyCodeFile({ file_paths: ["docs.md"] }), false);
});

test("editedAnyCodeFile: unexpected/empty shapes → false, never throws", () => {
  assert.equal(editedAnyCodeFile(null), false);
  assert.equal(editedAnyCodeFile(undefined), false);
  assert.equal(editedAnyCodeFile({}), false);
  assert.equal(editedAnyCodeFile("nope"), false);
  assert.equal(editedAnyCodeFile({ edits: "not-an-array" }), false);
});

// --- best-effort reader: readTranscriptSignals (never throws) ---

test("readTranscriptSignals: missing/empty path → {editedCode:false, ranTests:false}, never throws", () => {
  assert.deepEqual(readTranscriptSignals(""), { editedCode: false, ranTests: false });
  // @ts-expect-error testing untrusted input
  assert.deepEqual(readTranscriptSignals(null), { editedCode: false, ranTests: false });
  assert.deepEqual(readTranscriptSignals("D:/nope/does-not-exist.jsonl"), {
    editedCode: false,
    ranTests: false,
  });
});
