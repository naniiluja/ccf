import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const pluginRoot = join(repoRoot, "plugins", "ccf");
const agentPath = join(pluginRoot, "agents", "ccf-finding-refuter.md");
const checkPath = join(pluginRoot, "commands", "check.md");
const checkerPath = join(pluginRoot, "agents", "ccf-spec-checker.md");

function read(path) {
  return readFileSync(path, "utf8").replace(/\r\n/g, "\n");
}

function frontmatter(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---\n/);
  assert.ok(match, "missing frontmatter");
  const fields = {};
  for (const line of match[1].split("\n")) {
    const index = line.indexOf(":");
    if (index > 0) fields[line.slice(0, index).trim()] = line.slice(index + 1).trim();
  }
  return { fields, body: text.slice(match[0].length) };
}

function styleBullets(text) {
  return text.split("\n").filter((line) => line.startsWith("- ")).filter((line, i, all) => {
    const start = all.findIndex((l) => l.startsWith("- Write in the SAME language"));
    return start >= 0 && i >= start && i < start + 13;
  });
}

function step6c(text) {
  const start = text.indexOf("6c.");
  assert.ok(start >= 0, "check.md has no step 6c");
  const end = text.indexOf("## Closing", start);
  return text.slice(start, end < 0 ? undefined : end);
}

test("refuter agent file exists", () => {
  assert.ok(existsSync(agentPath));
});

test("refuter frontmatter matches the task", () => {
  const { fields } = frontmatter(read(agentPath));
  assert.equal(fields.name, "ccf-finding-refuter");
  assert.equal(fields.model, "sonnet");
  assert.equal(fields.effort, "medium");
  assert.equal(fields.maxTurns, "25");
  assert.equal(fields.disallowedTools, "Write, Edit, NotebookEdit, Agent, Task");
  assert.match(fields.description, /^"?Use when/);
  assert.ok(fields.description.includes("Read-only"));
});

test("refuter body opens with its role and closes with its return format", () => {
  const { body } = frontmatter(read(agentPath));
  assert.match(body.trimStart(), /^You are the \*\*CCF Finding Refuter\*\*/);
  const headings = body.split("\n").filter((line) => line.startsWith("## "));
  assert.equal(headings.at(-1), "## Return format");
  const returnFormat = body.slice(body.lastIndexOf("## Return format"));
  assert.match(returnFormat, /REFUTED `?<file:line>/);
  assert.match(returnFormat, /STANDS `?<file:line>/);
});

test("refuter states no evidence means STANDS and adds no new findings", () => {
  const { body } = frontmatter(read(agentPath));
  assert.match(body, /No evidence means `?STANDS`?/);
  assert.match(body, /add no new findings/i);
});

test("refuter carries the style block byte-identical to check.md", () => {
  const agentBlock = styleBullets(read(agentPath));
  const checkBlock = styleBullets(read(checkPath));
  assert.equal(agentBlock.length, 13);
  assert.deepEqual(agentBlock, checkBlock);
});

test("check.md step 6c spawns the refuter only when a FAIL exists, synchronously", () => {
  const section = step6c(read(checkPath));
  assert.ok(section.includes("ccf-finding-refuter"));
  assert.match(section, /only when[^.]*`FAIL:`/);
  assert.ok(section.includes("run_in_background: false"));
  assert.ok(section.includes("SendMessage"));
  assert.ok(section.includes("Refuted (ccf-finding-refuter):"));
});

test("check.md step 6c never deletes or downgrades and keeps the FAIL count equal", () => {
  const section = step6c(read(checkPath));
  assert.match(section, /[Nn]ever delete or downgrade a `FAIL:`/);
  assert.match(section, /`FAIL:` line count before and after this step is equal/);
  assert.match(section, /user decides/);
});

test("check.md allowed-tools keeps Task and SendMessage", () => {
  const { fields } = frontmatter(read(checkPath));
  const tools = fields["allowed-tools"].split(",").map((t) => t.trim());
  assert.ok(tools.includes("Task"));
  assert.ok(tools.includes("SendMessage"));
});

test("run_in_background: false appears on 9 lines across commands and the plan skill", () => {
  const files = ["check.md", "init.md", "cook.md", "updatespec.md"].map((f) => join(pluginRoot, "commands", f));
  files.push(join(pluginRoot, "skills", "plan", "SKILL.md"));
  const total = files
    .map((f) => read(f).split("\n").filter((line) => line.includes("run_in_background: false")).length)
    .reduce((a, b) => a + b, 0);
  assert.equal(total, 9);
});

test("review-trace keys only on ccf-spec-checker", () => {
  const source = read(join(pluginRoot, "hooks", "lib", "review-trace.mjs"));
  assert.ok(source.includes("ccf-spec-checker"));
  assert.ok(!source.includes("ccf-finding-refuter"));
});

function step6Merge(text) {
  const start = text.indexOf("6. **Merge the reports");
  assert.ok(start >= 0, "check.md has no step 6");
  const end = text.indexOf("6b.", start);
  return text.slice(start, end < 0 ? undefined : end);
}

test("spec checker lets a real repro: stand in for a rule quote", () => {
  const { body } = frontmatter(read(checkerPath));
  assert.ok(body.includes('repro: "<command run>" -> "<real output>"'));
  assert.match(body, /`FAIL:`\*\* needs a score of 80 or more AND either that verbatim quote or a `repro:`/);
  assert.match(body, /[Aa]nalysis without a command you ran is at most `WARN:`/);
});

test("spec checker return format puts repro: on the FAIL line", () => {
  const { body } = frontmatter(read(checkerPath));
  const returnFormat = body.slice(body.lastIndexOf("## Return format"));
  assert.match(returnFormat, /- FAIL: [^\n]*rule: "<verbatim quote>"[^\n]*repro: "<command run>" -> "<real output>"/);
});

test("check.md step 6 names the condition under which a FAIL: stands", () => {
  const section = step6Merge(read(checkPath));
  assert.match(section, /`FAIL:` stands only with a score of 80 or more and either a verbatim rule or criterion quote or a `repro:`/);
});
