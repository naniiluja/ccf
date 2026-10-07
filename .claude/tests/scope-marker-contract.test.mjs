import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const pluginRoot = join(repoRoot, "plugins", "ccf");
const checkPath = join(pluginRoot, "commands", "check.md");
const agentPaths = {
  "ccf-scope-checker.md": join(pluginRoot, "agents", "ccf-scope-checker.md"),
  "ccf-spec-checker.md": join(pluginRoot, "agents", "ccf-spec-checker.md"),
};

function read(path) {
  return readFileSync(path, "utf8").replace(/\r\n/g, "\n");
}

function step6(text) {
  const start = text.indexOf("6. ");
  assert.ok(start >= 0, "check.md has no step 6");
  const end = text.indexOf("6b.", start);
  return text.slice(start, end < 0 ? undefined : end);
}

function exampleFailLines(text) {
  return text.split("\n").filter((line) => line.startsWith("- FAIL:"));
}

test("every parenthesized tag check.md step 6 names appears right after the marker in the scope checker", () => {
  const tags = [...new Set(step6(read(checkPath)).match(/\((?:spec\+scope|spec|scope)\)/g) ?? [])];
  assert.ok(tags.includes("(scope)") && tags.includes("(spec)"), "check.md step 6 names no source tags");
  const scopeAgent = read(agentPaths["ccf-scope-checker.md"]);
  assert.ok(
    exampleFailLines(scopeAgent).some((line) => line.startsWith("- FAIL: (scope) ")),
    "scope checker example must read `- FAIL: (scope) ` with the tag right after the marker",
  );
});

for (const [name, path] of Object.entries(agentPaths)) {
  test(`${name}: no FAIL example has a bare word in the tag slot`, () => {
    const lines = exampleFailLines(read(path));
    assert.ok(lines.length > 0, `${name} has no FAIL example line`);
    for (const line of lines) {
      assert.match(
        line,
        /^- FAIL: (?:\([^)\n]+\)|<[^>\n]+>) /,
        `tag slot must be parenthesized or a <placeholder>: ${line}`,
      );
    }
  });
}
