import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  stripDependsOnLine,
  extractTaskTitle,
  loadTaskFiles,
  mapIterations,
  toCorpusTask,
  buildCorpus,
} from "./backtest-corpus.mjs";

const TASK_901 = `# Task 901 — Alpha

- **Depends on:** —

## Acceptance criteria (verifiable)
- [ ] alpha done

## Files to touch
- a.mjs — alpha work
`;
const TASK_902 = `# Task 902 — Beta

- **Depends on:** 901

## Acceptance criteria (verifiable)
- [ ] beta done

## Files to touch
- a.mjs — beta work
`;
const TASK_903 = `# Task 903 — Gamma

- **Depends on:** 901

## Acceptance criteria (verifiable)
- [ ] gamma done

## Files to touch
- b.mjs — gamma work
`;
const TASK_904 = `# Task 904 — Delta

- **Depends on:** —

## Acceptance criteria (verifiable)
- [ ] delta done

## Files to touch
- c.mjs — delta work
`;

function fixtureDir() {
  const dir = mkdtempSync(join(tmpdir(), "backtest-corpus-"));
  mkdirSync(join(dir, "archive"));
  writeFileSync(join(dir, "archive", "task-901-alpha.md"), TASK_901);
  writeFileSync(join(dir, "archive", "task-902-beta.md"), TASK_902);
  writeFileSync(join(dir, "archive", "task-903-gamma.md"), TASK_903);
  writeFileSync(join(dir, "archive", "task-904-delta.md"), TASK_904);
  writeFileSync(join(dir, "ARCHIVE.md"), [
    "## Origin: fixture-iter (task 901 đến 904)",
    "",
    "## Task backlog — fixture-iter",
    "| # | Slice |",
    "|---|---|",
    "| 901 | alpha |",
    "| 902 | beta |",
    "| 903 | gamma |",
    "| 904 | delta |",
    "",
    "## Origin: other-iter (task 905)",
    "",
    "## Task backlog — other-iter",
    "| # | Slice |",
    "|---|---|",
    "",
  ].join("\n"));
  return dir;
}

test("stripDependsOnLine removes the Depends on line only", () => {
  const stripped = stripDependsOnLine(TASK_903);
  assert.ok(!/depends on/i.test(stripped));
  assert.ok(stripped.includes("## Files to touch"));
  assert.ok(stripped.includes("gamma done"));
});

test("extractTaskTitle reads the H1 title", () => {
  assert.equal(extractTaskTitle(TASK_901, "task-901-alpha.md"), "Alpha");
});

test("mapIterations groups task ids by Origin section", () => {
  const dir = fixtureDir();
  const map = mapIterations(readFileSync(join(dir, "ARCHIVE.md"), "utf8"));
  assert.equal(map.iterationOf("901"), "fixture-iter");
  assert.equal(map.iterationOf("904"), "fixture-iter");
  assert.equal(map.iterationOf("999"), null);
});

test("loadTaskFiles reads archived task files", () => {
  const dir = fixtureDir();
  const loaded = loadTaskFiles(join(dir, "archive"));
  assert.equal(loaded.length, 4);
  assert.deepEqual(loaded.map((t) => t.id).sort(), ["901", "902", "903", "904"]);
});

test("loadTaskFiles and mapIterations handle suffixed ids like 024a", () => {
  const dir = mkdtempSync(join(tmpdir(), "backtest-corpus-suffix-"));
  mkdirSync(join(dir, "archive"));
  writeFileSync(join(dir, "archive", "task-024a-live-verify.md"), TASK_901);
  writeFileSync(join(dir, "ARCHIVE.md"), [
    "## Origin: some-iter (task 024a)",
    "",
    "## Task backlog — some-iter",
    "| # | Slice |",
    "|---|---|",
    "| 024a | live verify |",
    "",
  ].join("\n"));
  const loaded = loadTaskFiles(join(dir, "archive"));
  assert.deepEqual(loaded.map((t) => t.id), ["024a"]);
  const map = mapIterations(readFileSync(join(dir, "ARCHIVE.md"), "utf8"));
  assert.equal(map.iterationOf("024a"), "some-iter");
});

test("toCorpusTask keeps dependsOn for ground truth but strips it from jevText", () => {
  const t = toCorpusTask({ id: "903", filename: "task-903-gamma.md", text: TASK_903 });
  assert.deepEqual(t.dependsOn, ["901"]);
  assert.deepEqual(t.files, ["b.mjs"]);
  assert.ok(!/depends on/i.test(t.jevText));
  assert.ok(t.jevText.includes("b.mjs"));
});

test("buildCorpus: positives are declared deps code cannot catch", () => {
  const dir = fixtureDir();
  const corpus = buildCorpus({
    archiveDir: join(dir, "archive"),
    archiveMd: readFileSync(join(dir, "ARCHIVE.md"), "utf8"),
  });
  const posKeys = corpus.positives.map((p) => `${p.a.id}->${p.b.id}`).sort();
  assert.deepEqual(posKeys, ["901->903"]);
});

test("buildCorpus: negatives exclude declared and code-decided pairs", () => {
  const dir = fixtureDir();
  const corpus = buildCorpus({
    archiveDir: join(dir, "archive"),
    archiveMd: readFileSync(join(dir, "ARCHIVE.md"), "utf8"),
    maxNegatives: 10,
    seed: 1,
  });
  const negKeys = corpus.negatives.map((p) => `${p.a.id}->${p.b.id}`).sort();
  assert.deepEqual(negKeys, ["901->904", "902->903", "902->904", "903->904"]);
  for (const p of corpus.negatives) {
    assert.ok(!/depends on/i.test(p.a.jevText));
    assert.ok(!/depends on/i.test(p.b.jevText));
  }
});

test("buildCorpus: negative sampling is reproducible with a fixed seed", () => {
  const dir = fixtureDir();
  const opts = {
    archiveDir: join(dir, "archive"),
    archiveMd: readFileSync(join(dir, "ARCHIVE.md"), "utf8"),
    maxNegatives: 2,
    seed: 42,
  };
  const c1 = buildCorpus(opts);
  const c2 = buildCorpus(opts);
  assert.deepEqual(
    c1.negatives.map((p) => p.a.id + p.b.id),
    c2.negatives.map((p) => p.a.id + p.b.id),
  );
});
