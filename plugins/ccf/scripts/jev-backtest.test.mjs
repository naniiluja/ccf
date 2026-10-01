import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runBacktest } from "./jev-backtest.mjs";

const T901 = `# Task 901 — Alpha

- **Depends on:** —

## Acceptance criteria (verifiable)
- [ ] alpha done

## Files to touch
- a.mjs — alpha work
`;
const T902 = `# Task 902 — Beta

- **Depends on:** 901

## Acceptance criteria (verifiable)
- [ ] beta done

## Files to touch
- b.mjs — beta work
`;
const T903 = `# Task 903 — Gamma

- **Depends on:** —

## Acceptance criteria (verifiable)
- [ ] gamma done

## Files to touch
- c.mjs — gamma work
`;

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), "jev-backtest-"));
  mkdirSync(join(dir, "archive"));
  writeFileSync(join(dir, "archive", "task-901-alpha.md"), T901);
  writeFileSync(join(dir, "archive", "task-902-beta.md"), T902);
  writeFileSync(join(dir, "archive", "task-903-gamma.md"), T903);
  const archiveMd = [
    "## Origin: fixture (task 901 đến 903)",
    "",
    "## Task backlog — fixture",
    "| # | Slice |",
    "|---|---|",
    "| 901 | alpha |",
    "| 902 | beta |",
    "| 903 | gamma |",
    "",
  ].join("\n");
  return { dir, archiveMd };
}

function mockFetch(t, positiveDepQid) {
  return async (url, opts) => {
    t.assert.ok(String(url).includes("/v1/systemone"));
    const body = JSON.parse(String(opts.body));
    t.assert.ok(body.state && Array.isArray(body.state.tasks));
    const answers = {};
    for (const qid of Object.keys(body.questions)) {
      answers[qid] = { type: "noul", noul: qid === positiveDepQid ? 0.9 : 0.1 };
    }
    return { ok: true, json: async () => ({ answers }) };
  };
}

test("runBacktest: scores pairs end to end with mocked Jev", async (t) => {
  const { dir, archiveMd } = fixture();
  const report = await runBacktest({
    archiveDir: join(dir, "archive"),
    archiveMd,
    apiKey: "test-key",
    fetchImpl: mockFetch(t, "dep_0_1"),
    maxNegatives: 60,
    seed: 1,
  });
  assert.equal(report.ok, true);
  assert.equal(report.positives, 1);
  assert.equal(report.negatives, 2);
  assert.equal(report.stats.positivePairs, 1);
  assert.equal(report.stats.negativeSample, 2);
  assert.equal(report.counts.tp, 1);
  assert.equal(report.counts.fn, 0);
  assert.equal(report.counts.fp, 0);
  assert.equal(report.counts.tn, 2);
  assert.equal(report.recall, 1);
  assert.equal(report.fpr, 0);
  assert.ok(report.batches >= 1);
  assert.equal(typeof report.threshold, "number");
});

test("runBacktest: no key yields no-key without network", async () => {
  const { dir, archiveMd } = fixture();
  let called = false;
  const report = await runBacktest({
    archiveDir: join(dir, "archive"),
    archiveMd,
    apiKey: "",
    fetchImpl: async () => {
      called = true;
      throw new Error("must not be called");
    },
  });
  assert.deepEqual(report, { ok: false, reason: "no-key" });
  assert.equal(called, false);
});
