import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { hasVersionEntry } from "../../plugins/ccf/hooks/lib/eval-changelog.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const VERSION = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).version;
const CHANGELOG = readFileSync(join(ROOT, "CHANGELOG.md"), "utf8");

test(`CHANGELOG.md has an entry for package.json version ${VERSION} with a score table or an eval: not run: line`, () => {
  assert.ok(
    hasVersionEntry(CHANGELOG, VERSION),
    `CHANGELOG.md needs "## ${VERSION}" with an eval score table or "eval: not run: <reason>"; run plugins/ccf/scripts/eval-changelog.mjs`,
  );
});

test("CHANGELOG.md is not @imported by CLAUDE.md, so it costs nothing per session", () => {
  assert.doesNotMatch(readFileSync(join(ROOT, "CLAUDE.md"), "utf8"), /^@CHANGELOG\.md/m);
});
