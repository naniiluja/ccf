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

test("runtime evidence (083): the brief fills it in the agent's own task file, and the preflight names the block", () => {
  assert.match(BRIEF, /fill `Runtime evidence` in your OWN task file/);
  assert.match(BRIEF, /`not run: <reason>`/);
  assert.match(BRIEF, /the one exception to leaving task files alone/);
  assert.match(COOK, /`missing-runtime-evidence`/);
});

test("runtime evidence (083): check.md grades it, updatespec.md caps a not-run UI task at accepted", () => {
  const CHECK = readFileSync(join(ROOT, "plugins", "ccf", "commands", "check.md"), "utf8");
  const UPDATESPEC = readFileSync(join(ROOT, "plugins", "ccf", "commands", "updatespec.md"), "utf8");
  assert.match(CHECK, /an empty `Runtime evidence` is a `FAIL:`/);
  assert.match(CHECK, /`not run: <reason>` is a `WARN:`/);
  assert.match(UPDATESPEC, /`Runtime evidence` reads `not run: <reason>` closes only as `accepted`, never `done`/);
});

test("runtime evidence (083): the task template carries both fields", () => {
  const TEMPLATE = readFileSync(join(ROOT, "plugins", "ccf", "templates", "root", ".claude", "plan", "task-template.md.tmpl"), "utf8");
  assert.match(TEMPLATE, /^- \*\*Touches UI:\*\* \{\{TOUCHES_UI\}\}/m);
  assert.match(TEMPLATE, /^- \*\*Runtime evidence:\*\*/m);
  assert.match(TEMPLATE, /not run: <reason>/);
});

test("templates: no generated project inherits the old strictly-sequential law", () => {
  for (const file of templateFiles()) {
    assert.doesNotMatch(readFileSync(file, "utf8"), /STRICTLY SEQUENTIAL|exactly ONE predecessor|no \*\*writing\*\* agents in parallel/, file);
  }
});
