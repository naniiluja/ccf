import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const hooksJson = JSON.parse(readFileSync(join(repoRoot, "plugins", "ccf", "hooks", "hooks.json"), "utf8"));

function commandHooks() {
  return Object.values(hooksJson.hooks).flatMap((groups) => groups.flatMap((group) => group.hooks));
}

function hookRunning(script) {
  const found = commandHooks().filter((hook) => String(hook.command ?? "").includes(`/hooks/${script}`));
  assert.equal(found.length, 1, `hooks.json must run ${script} exactly once`);
  return found[0];
}

test("plan-mode-guard fails closed: onFailure is block", () => {
  assert.equal(hookRunning("plan-mode-guard.mjs").onFailure, "block");
});

test("plan-mode-guard stays a UserPromptSubmit hook", () => {
  const promptHooks = hooksJson.hooks.UserPromptSubmit.flatMap((group) => group.hooks);
  assert.ok(promptHooks.some((hook) => String(hook.command).includes("/hooks/plan-mode-guard.mjs")));
});

for (const script of [
  "plan-skill-inject.mjs",
  "session-start.mjs",
  "updatespec-nudge.mjs",
  "auto-verify.mjs",
  "completion-evidence.mjs",
  "explore-guide-inject.mjs",
]) {
  test(`${script} stays fail-open: no onFailure block`, () => {
    assert.notEqual(hookRunning(script).onFailure, "block");
  });
}
