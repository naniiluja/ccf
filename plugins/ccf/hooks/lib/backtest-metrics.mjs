import { EDGE_THRESHOLD } from "./slice-check.mjs";
import { noulValue } from "./completion-evidence.mjs";

const QUESTIONS = ["dep", "contract", "shared_state"];

/** @param {any} answers @param {any} qid @returns {number | null} */
function pOf(answers, qid) {
  return noulValue(answers?.[qid]);
}

/**
 * @param {any} pairs
 * @param {any} answers
 * @param {{ edgeThreshold?: number }} [opts]
 */
export function evaluatePairs(pairs, answers, opts = {}) {
  const threshold = typeof opts?.edgeThreshold === "number" ? opts.edgeThreshold : EDGE_THRESHOLD;
  const list = Array.isArray(pairs) ? pairs : [];
  const counts = { tp: 0, fn: 0, fp: 0, tn: 0, positives: 0, negatives: 0, unanswered: 0 };
  const perQ = Object.fromEntries(
    QUESTIONS.map((q) => [q, { tp: 0, fn: 0, fp: 0, tn: 0, answered: 0 }]),
  );
  for (const pair of list) {
    const label = pair?.label === "positive" ? "positive" : "negative";
    const qids = pair?.qids ?? {};
    const ps = QUESTIONS.map((q) => pOf(answers, qids[q]));
    const unanswered = ps.some((p) => p === null);
    const fired = ps.some((p) => p !== null && p >= threshold);
    const predicted = fired || unanswered;
    if (unanswered) counts.unanswered++;
    if (label === "positive") {
      counts.positives++;
      if (predicted) counts.tp++;
      else counts.fn++;
    } else {
      counts.negatives++;
      if (predicted) counts.fp++;
      else counts.tn++;
    }
    QUESTIONS.forEach((q, k) => {
      const p = ps[k];
      if (p === null) return;
      perQ[q].answered++;
      const hit = p >= threshold;
      if (label === "positive") {
        if (hit) perQ[q].tp++;
        else perQ[q].fn++;
      } else if (hit) perQ[q].fp++;
      else perQ[q].tn++;
    });
  }
  /** @param {number} num @param {number} den */
  const rate = (num, den) => (den > 0 ? num / den : null);
  const perQuestion = Object.fromEntries(
    QUESTIONS.map((q) => {
      const s = perQ[q];
      return [
        q,
        {
          answered: s.answered,
          recall: rate(s.tp, s.tp + s.fn),
          positiveRate: rate(s.fp, s.fp + s.tn),
        },
      ];
    }),
  );
  return {
    counts,
    recall: rate(counts.tp, counts.tp + counts.fn),
    fpr: rate(counts.fp, counts.fp + counts.tn),
    unansweredRate: rate(counts.unanswered, counts.positives + counts.negatives),
    perQuestion,
  };
}
