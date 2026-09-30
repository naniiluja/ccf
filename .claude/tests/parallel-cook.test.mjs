import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const COOK = readFileSync(join(ROOT, "plugins", "ccf", "commands", "cook.md"), "utf8");
const BRIEF = COOK.slice(COOK.indexOf("<agent-brief>"), COOK.indexOf("</agent-brief>"));

const templateFiles = (dir = join(ROOT, "plugins", "ccf", "templates")) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? templateFiles(join(dir, e.name)) : e.name.endsWith(".tmpl") ? [join(dir, e.name)] : []);

test("cook.md: writers are spawned in one message, each with worktree isolation, and waited for", () => {
  assert.match(COOK, /SINGLE message/);
  assert.match(COOK, /Each call carries `subagent_type: "general-purpose"`, `isolation: "worktree"`, `run_in_background: false`/);
});

test("cook.md: the preflight gate comes before integrate-wave, and the merged result is tested after every merge", () => {
  const preflight = COOK.indexOf("worktree-preflight.mjs\" --branches");
  const integrate = COOK.indexOf("integrate-wave.mjs\" --branches");
  assert.ok(preflight > 0 && integrate > preflight);
  assert.match(COOK, /\*\*`ready: false` → STOP\*\*/);
  assert.match(COOK, /after EACH merge/);
});

test("cook.md: any FAIL: or PARTIAL: stops before /ccf:updatespec", () => {
  assert.match(COOK, /\*\*Any `FAIL:` or `PARTIAL:` anywhere → STOP/);
});

test("cook.md brief: the agent branches from an explicit base and never enters or exits a worktree itself", () => {
  assert.ok(BRIEF.length > 0);
  assert.match(BRIEF, /git switch -c \{\{BRANCH\}\} \{\{BASE\}\}/);
  assert.match(BRIEF, /do not call EnterWorktree or ExitWorktree/);
  assert.match(BRIEF, /Never push, merge, rebase or reset/);
});

test("templates: no generated project inherits the old strictly-sequential law", () => {
  for (const file of templateFiles()) {
    assert.doesNotMatch(readFileSync(file, "utf8"), /STRICTLY SEQUENTIAL|exactly ONE predecessor|no \*\*writing\*\* agents in parallel/, file);
  }
});
