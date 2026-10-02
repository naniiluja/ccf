import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const pluginRoot = join(repoRoot, "plugins", "ccf");
const MUTATING_COMMANDS = new Set(["cook", "init"]);

function listMarkdown(subdir) {
  const dir = join(pluginRoot, subdir);
  return readdirSync(dir)
    .filter((name) => name.endsWith(".md"))
    .map((name) => ({ kind: subdir, name: basename(name, ".md"), path: join(dir, name) }));
}

function readDescription(path) {
  const text = readFileSync(path, "utf8").replace(/\r\n/g, "\n");
  const match = text.match(/^---\n([\s\S]*?)\n---/);
  assert.ok(match, `${path} has no frontmatter`);
  const line = match[1].split("\n").find((l) => l.startsWith("description:"));
  assert.ok(line, `${path} has no description`);
  return line.slice("description:".length).trim();
}

function unquote(raw) {
  return raw.startsWith('"') && raw.endsWith('"') ? raw.slice(1, -1) : raw;
}

const files = [...listMarkdown("commands"), ...listMarkdown("agents")];

test("both directories hold files to check", () => {
  assert.ok(files.some((f) => f.kind === "commands"));
  assert.ok(files.some((f) => f.kind === "agents"));
});

for (const file of files) {
  test(`${file.kind}/${file.name} description is trigger-style`, () => {
    const raw = readDescription(file.path);
    assert.match(raw, /^"?Use (only )?when/);
    assert.ok(unquote(raw).length <= 1536, `${file.name} description exceeds 1536 characters`);
    if (!raw.startsWith('"') && !raw.startsWith("'")) {
      assert.ok(!raw.includes(": "), `${file.name} unquoted description contains ": "`);
    }
  });
}

for (const file of files.filter((f) => f.kind === "commands" && MUTATING_COMMANDS.has(f.name))) {
  test(`commands/${file.name} runs only on explicit request`, () => {
    assert.ok(readDescription(file.path).includes("only when the user explicitly asks"));
  });
}

for (const file of files.filter((f) => f.kind === "agents")) {
  test(`agents/${file.name} keeps Read-only`, () => {
    assert.ok(readDescription(file.path).includes("Read-only"));
  });
}
