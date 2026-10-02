import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SKILL_DIR = join(ROOT, "plugins", "ccf", "skills", "grill-me");
const SKILL_PATH = join(SKILL_DIR, "SKILL.md");
const INIT_PATH = join(SKILL_DIR, "references", "init-mode.md");
const SKILL = readFileSync(SKILL_PATH, "utf8");
const FRONTMATTER = SKILL.slice(4, SKILL.indexOf("\n---", 4));
const readInit = () => (existsSync(INIT_PATH) ? readFileSync(INIT_PATH, "utf8") : "");

const descriptionValue = () => {
  const line = FRONTMATTER.split("\n").find((l) => l.startsWith("description:"));
  assert.ok(line);
  return line.slice("description:".length).trim();
};

const gotchaBullets = () => {
  const start = SKILL.indexOf("\n## Gotchas");
  assert.ok(start >= 0);
  const rest = SKILL.slice(start + 1);
  const next = rest.indexOf("\n## ");
  const section = next >= 0 ? rest.slice(0, next) : rest;
  return section.split("\n").filter((l) => /^\s*[-*] /.test(l));
};

test("grill-me SKILL.md is at most 4,500 bytes", () => {
  assert.ok(Buffer.byteLength(SKILL, "utf8") <= 4500);
});

test("references/init-mode.md carries every init label (a) through (l), including (e2)", () => {
  const init = readInit();
  for (const label of ["a", "b", "c", "d", "e", "e2", "f", "g", "h", "i", "j", "k", "l"]) {
    assert.match(init, new RegExp(`\\(${label}\\)`));
  }
});

test("SKILL.md links to references/init-mode.md", () => {
  assert.match(SKILL, /references\/init-mode\.md/);
});

test("SKILL.md has a Gotchas section and every bullet cites a source", () => {
  const bullets = gotchaBullets();
  assert.ok(bullets.length > 0);
  for (const bullet of bullets) assert.match(bullet, /\.md|task \d{3}/);
});

test("description opens with Use when, fits 1,536 chars, and avoids an unquoted colon-space", () => {
  const value = descriptionValue();
  assert.match(value, /^"?Use when/);
  assert.ok(value.length <= 1536);
  if (!value.startsWith('"')) assert.ok(!value.includes(": "));
});

test("user-invocable: false is kept", () => {
  assert.match(FRONTMATTER, /^user-invocable: false$/m);
});
