import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SKILL_DIR = join(ROOT, "plugins", "ccf", "skills", "plan");
const SKILL_PATH = join(SKILL_DIR, "SKILL.md");
const SKILL = readFileSync(SKILL_PATH, "utf8");
const REFERENCES = ["references/jev-slice-check.md", "references/test-discipline.md"];

const styleBlock = (text) => {
  const lines = text.split("\n");
  const start = lines.findIndex((l) => l.startsWith("- Write in the SAME language"));
  return lines.slice(start, start + 13).join("\n") + "\n";
};

const gotchaBullets = () => {
  const start = SKILL.indexOf("## Gotchas");
  assert.ok(start >= 0, "## Gotchas heading missing");
  const rest = SKILL.slice(start + "## Gotchas".length);
  const next = rest.search(/\n## /);
  const section = next >= 0 ? rest.slice(0, next) : rest;
  return section.split("\n").filter((l) => l.startsWith("- "));
};

test("plan SKILL.md does not grow past 15,749 bytes", () => {
  assert.ok(statSync(SKILL_PATH).size <= 15749, `size ${statSync(SKILL_PATH).size}`);
});

test("both references files exist and are linked from SKILL.md with a read condition", () => {
  for (const ref of REFERENCES) {
    assert.ok(existsSync(join(SKILL_DIR, ref)), `${ref} missing`);
    const line = SKILL.split("\n").find((l) => l.includes(ref));
    assert.ok(line, `${ref} not linked`);
    assert.match(line, /\b(When|If|when|if)\b/);
  }
});

test("step headings 0 through 7 and 5b still exist", () => {
  for (let n = 0; n <= 7; n++) assert.match(SKILL, new RegExp(`^## ${n}\\.`, "m"));
  assert.match(SKILL, /^### 5b/m);
});

test("style block is byte-identical to the canonical md5", () => {
  const block = styleBlock(SKILL);
  assert.equal(Buffer.byteLength(block), 1479);
  assert.equal(createHash("md5").update(block).digest("hex"), "deac0ef73d3c0cb9d26766027a906385");
});

test("discipline: on is present", () => {
  assert.ok(SKILL.includes("discipline: on"));
});

test("Gotchas has at least 5 bullets, each citing a source", () => {
  const bullets = gotchaBullets();
  assert.ok(bullets.length >= 5, `only ${bullets.length} bullets`);
  for (const b of bullets) assert.match(b, /\.md|task \d{3}/);
});

test("description still leads with Use when", () => {
  const description = SKILL.split("\n").find((l) => l.startsWith("description:"));
  assert.match(description.replace(/^description:\s*/, ""), /^"?Use when/);
});

test("run_in_background: false appears on exactly 2 lines", () => {
  assert.equal(SKILL.split("\n").filter((l) => l.includes("run_in_background: false")).length, 2);
});
