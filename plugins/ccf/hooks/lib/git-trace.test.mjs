// Tests for lib/git-trace.mjs — node --test, no dependency.
// Guards committedThisSession: true only for `git commit` in an ASSISTANT shell tool_use
// (role-gated — user prose "i will git commit" must NOT match); false on bad transcripts.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { committedThisSession } from "./git-trace.mjs";

/** Write `lines` (array of JSON-serializable objects) as a .jsonl transcript; return its path. */
function tmpTranscript(lines) {
  const dir = mkdtempSync(join(tmpdir(), "ccf-git-trace-test-"));
  const file = join(dir, "transcript.jsonl");
  writeFileSync(file, lines.map((l) => (typeof l === "string" ? l : JSON.stringify(l))).join("\n"), "utf8");
  return { file, dir };
}

/** An assistant line carrying a single shell tool_use with `command`. */
function assistantShell(command, name = "bash") {
  return {
    type: "assistant",
    message: { content: [{ type: "tool_use", name, input: { command } }] },
  };
}

test("committedThisSession: true for a plain `git commit` in an assistant shell block", () => {
  const { file, dir } = tmpTranscript([assistantShell("git commit")]);
  try {
    assert.equal(committedThisSession(file), true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("committedThisSession: true for `git commit -m \"x\"`", () => {
  const { file, dir } = tmpTranscript([assistantShell('git commit -m "x"')]);
  try {
    assert.equal(committedThisSession(file), true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("committedThisSession: true for `git commit --amend`", () => {
  const { file, dir } = tmpTranscript([assistantShell("git commit --amend")]);
  try {
    assert.equal(committedThisSession(file), true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("committedThisSession: true via a PowerShell shell tool", () => {
  const { file, dir } = tmpTranscript([assistantShell("git commit -m 'win'", "powershell")]);
  try {
    assert.equal(committedThisSession(file), true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("committedThisSession: FALSE for the same words in a USER prose message (role-gate)", () => {
  const { file, dir } = tmpTranscript([
    { type: "user", message: { content: [{ type: "text", text: "next i will git commit the change" }] } },
  ]);
  try {
    assert.equal(committedThisSession(file), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("committedThisSession: FALSE when no git commit ran (only `git status`)", () => {
  const { file, dir } = tmpTranscript([assistantShell("git status")]);
  try {
    assert.equal(committedThisSession(file), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("committedThisSession: false on a missing transcript path", () => {
  assert.equal(committedThisSession(join(tmpdir(), "no-such-transcript-xyz.jsonl")), false);
});

test("committedThisSession: false on an empty path", () => {
  assert.equal(committedThisSession(""), false);
});

test("committedThisSession: false on an empty transcript file", () => {
  const { file, dir } = tmpTranscript([]);
  try {
    assert.equal(committedThisSession(file), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("committedThisSession: false on corrupt-JSON lines (never throws)", () => {
  const { file, dir } = tmpTranscript(["{ this is not json", "also broken }}"]);
  try {
    assert.equal(committedThisSession(file), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
