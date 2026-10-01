#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildCorpus } from "../hooks/lib/backtest-corpus.mjs";
import { buildSliceRequests, DEFAULT_BATCH_SIZE, EDGE_THRESHOLD } from "../hooks/lib/slice-check.mjs";
import { askJev, JEV_DEFAULT_URL } from "../hooks/lib/jev-client.mjs";
import { withinSizeCap, DEFAULT_CAP_BYTES, noulValue } from "../hooks/lib/completion-evidence.mjs";
import { evaluatePairs } from "../hooks/lib/backtest-metrics.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..", "..");

/** @param {any} t */
function toSliceTask(t) {
  return { id: t.id, title: t.title, files: t.files, criteria: t.criteria, dependsOn: [] };
}

/**
 * @param {{ archiveDir?: string, archiveMd?: string, apiKey?: string, baseUrl?: string,
 *   fetchImpl?: (url: string, opts: any) => Promise<any>, maxNegatives?: number, seed?: number,
 *   batchSize?: number, edgeThreshold?: number, chunkPairs?: number, timeoutMs?: number }} [opts]
 */
export async function runBacktest({
  archiveDir = join(repoRoot, ".claude", "plan", "archive"),
  archiveMd = readFileSync(join(repoRoot, ".claude", "plan", "ARCHIVE.md"), "utf8"),
  apiKey = "",
  baseUrl = JEV_DEFAULT_URL,
  fetchImpl,
  maxNegatives = 60,
  seed = 20261001,
  batchSize = DEFAULT_BATCH_SIZE,
  edgeThreshold = EDGE_THRESHOLD,
  chunkPairs = 12,
  timeoutMs = 120000,
} = {}) {
  if (!apiKey) return { ok: false, reason: "no-key" };
  const corpus = buildCorpus({ archiveDir, archiveMd, maxNegatives, seed });
  const pairs = [
    ...corpus.positives.map((p) => ({ ...p, label: "positive" })),
    ...corpus.negatives.map((p) => ({ ...p, label: "negative" })),
  ];
  if (pairs.length === 0) return { ok: false, reason: "no-pairs", stats: corpus.stats };
  const askOpts = fetchImpl ? { fetchImpl } : {};
  /** @type {Record<string, any>} */
  const answers = {};
  /** @type {{ batch: number, reason: string }[]} */
  const skipped = [];
  let totalBatches = 0;
  const chunkSize = Math.max(1, Math.floor(chunkPairs));
  for (let c = 0; c < pairs.length; c += chunkSize) {
    const chunk = pairs.slice(c, c + chunkSize);
    const taskList = chunk.flatMap((p) => [toSliceTask(p.a), toSliceTask(p.b)]);
    const pairIndexes = chunk.map((_, l) => /** @type {[number, number]} */ ([2 * l, 2 * l + 1]));
    const { state, batches } = buildSliceRequests(taskList, { batchSize, pairs: pairIndexes });
    const depBatches = batches
      .map((b) => Object.fromEntries(Object.entries(b).filter(([id]) => !id.startsWith("fragment_"))))
      .filter((b) => Object.keys(b).length > 0);
    if (!withinSizeCap(JSON.stringify(state), DEFAULT_CAP_BYTES)) {
      return { ok: false, reason: "too-large", chunk: c, bytes: JSON.stringify(state).length, stats: corpus.stats };
    }
    for (const questions of depBatches) {
      const r = await askJev({ apiKey, baseUrl, state, questions, timeoutMs, ...askOpts });
      const batchIdx = totalBatches++;
      if (r && r.ok === true && r.answers && typeof r.answers === "object") {
        for (const [qid, ans] of Object.entries(r.answers)) answers[globalQid(qid, c)] = ans;
      } else {
        const reason = r && typeof r === "object" && "reason" in r && typeof r.reason === "string" ? r.reason : "bad-result";
        skipped.push({ batch: batchIdx, reason });
      }
    }
  }
  const scored = pairs.map((p, k) => ({
    key: `${p.a.id}->${p.b.id}`,
    label: p.label,
    qids: {
      dep: `dep_${2 * k}_${2 * k + 1}`,
      contract: `contract_${2 * k}_${2 * k + 1}`,
      shared_state: `shared_state_${2 * k}_${2 * k + 1}`,
    },
  }));
  const metrics = evaluatePairs(scored, answers, { edgeThreshold });
  const pairDetails = scored.map((s) => {
    const ps = Object.fromEntries(
      Object.entries(s.qids).map(([q, qid]) => [q, noulValue(answers[qid])]),
    );
    const unanswered = Object.values(ps).some((p) => p === null);
    const fired = Object.values(ps).some((p) => p !== null && p >= edgeThreshold);
    return { key: s.key, label: s.label, predicted: fired || unanswered, ps };
  });
  return {
    ok: true,
    threshold: edgeThreshold,
    batches: totalBatches,
    skipped,
    positives: corpus.stats.positivePairs,
    negatives: corpus.stats.negativeSample,
    stats: corpus.stats,
    pairDetails,
    ...metrics,
  };
}

/** @param {any} qid @param {any} chunkStart @returns {string} */
function globalQid(qid, chunkStart) {
  const m = /^([a-z_]+)_(\d+)_(\d+)$/.exec(String(qid));
  if (!m) return String(qid);
  return `${m[1]}_${Number(m[2]) + 2 * chunkStart}_${Number(m[3]) + 2 * chunkStart}`;
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const args = Object.fromEntries(
    process.argv.slice(2).map((a) => {
      const m = /^--([\w-]+)=(.+)$/.exec(a);
      return m ? [m[1], m[2]] : [a.replace(/^--/, ""), true];
    }),
  );
  try {
    const report = await runBacktest({
      apiKey: process.env.TYPESAFE_API_KEY ?? "",
      baseUrl: process.env.CCF_JEV_URL || JEV_DEFAULT_URL,
      maxNegatives: args["max-negatives"] ? Number(args["max-negatives"]) : 60,
      seed: args.seed ? Number(args.seed) : 20261001,
    });
    console.log(JSON.stringify(report));
  } catch {
    console.log(JSON.stringify({ ok: false, reason: "error" }));
  }
}
