import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluatePairs } from "./backtest-metrics.mjs";

const Q = (dep, contract, shared_state) => ({ dep, contract, shared_state });
const N = (v) => ({ type: "noul", noul: v });

function fixture() {
  const pairs = [
    { key: "p1", label: "positive", qids: Q("p1d", "p1c", "p1s") },
    { key: "p2", label: "positive", qids: Q("p2d", "p2c", "p2s") },
    { key: "p3", label: "positive", qids: Q("p3d", "p3c", "p3s") },
    { key: "n1", label: "negative", qids: Q("n1d", "n1c", "n1s") },
    { key: "n2", label: "negative", qids: Q("n2d", "n2c", "n2s") },
  ];
  const answers = {
    p1d: N(0.8), p1c: N(0.1), p1s: N(0.1),
    p2d: N(0.1), p2c: N(0.1), p2s: N(0.1),
    p3d: N(0.9), p3s: N(0.1),
    n1d: N(0.1), n1c: N(0.1), n1s: N(0.1),
    n2d: N(0.9), n2c: N(0.1), n2s: N(0.1),
  };
  return { pairs, answers };
}

test("evaluatePairs: recall, fpr and fail-closed unanswered", () => {
  const { pairs, answers } = fixture();
  const m = evaluatePairs(pairs, answers, { edgeThreshold: 0.3 });
  assert.deepEqual(m.counts, {
    tp: 2, fn: 1, fp: 1, tn: 1,
    positives: 3, negatives: 2, unanswered: 1,
  });
  assert.equal(m.recall, 2 / 3);
  assert.equal(m.fpr, 1 / 2);
  assert.equal(m.unansweredRate, 1 / 5);
});

test("evaluatePairs: per-question recall excludes unanswered", () => {
  const { pairs, answers } = fixture();
  const m = evaluatePairs(pairs, answers, { edgeThreshold: 0.3 });
  assert.equal(m.perQuestion.dep.recall, 2 / 3);
  assert.equal(m.perQuestion.dep.positiveRate, 1 / 2);
  assert.equal(m.perQuestion.contract.recall, 0 / 2);
  assert.equal(m.perQuestion.contract.answered, 4);
  assert.equal(m.perQuestion.shared_state.recall, 0 / 3);
});

test("evaluatePairs: empty sets give null rates, not NaN", () => {
  const m = evaluatePairs([], {});
  assert.equal(m.recall, null);
  assert.equal(m.fpr, null);
  assert.equal(m.unansweredRate, null);
});

test("evaluatePairs: threshold is honoured", () => {
  const { pairs, answers } = fixture();
  const m = evaluatePairs(pairs, answers, { edgeThreshold: 0.95 });
  assert.equal(m.counts.tp, 1);
  assert.equal(m.counts.fn, 2);
});
