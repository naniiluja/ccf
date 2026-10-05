import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { extractFiles, extractDependsOn, certainEdge } from "./slice-check.mjs";
import { extractAcceptanceCriteria } from "./completion-evidence.mjs";

const DEPENDS_ON_LINE = /^\s*[-*]?\s*\**depends on:?\**/im;

/** @param {any} text @returns {string} */
export function stripDependsOnLine(text) {
  if (typeof text !== "string") return "";
  return text
    .split(/\r?\n/)
    .filter((line) => !DEPENDS_ON_LINE.test(line))
    .join("\n");
}

/** @param {any} text @param {any} filename @returns {string} */
export function extractTaskTitle(text, filename = "") {
  const m = /^#\s+Task\s+[\w-]+\s+[—–-]\s*(.+?)\s*$/m.exec(String(text ?? ""));
  if (m) return m[1];
  const slug = String(filename).replace(/\.md$/i, "").replace(/^task-\d+-?/i, "");
  return slug.replace(/[-_]+/g, " ").trim() || "untitled";
}

/** @param {any} archiveDir @returns {{ id: string, filename: string, text: string }[]} */
export function loadTaskFiles(archiveDir) {
  const out = [];
  for (const f of readdirSync(archiveDir)) {
    const m = /^task-(\d+[a-z]?)-.*\.md$/i.exec(f);
    if (!m) continue;
    out.push({ id: m[1].toLowerCase(), filename: f, text: readFileSync(join(archiveDir, f), "utf8") });
  }
  return out.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
}

/** @param {any} archiveMd @returns {{ names: string[], iterationOf: (id: any) => string | null }} */
export function mapIterations(archiveMd) {
  /** @type {Map<string, string>} */
  const idToIter = new Map();
  /** @type {string[]} */
  const names = [];
  for (const section of String(archiveMd ?? "").split(/^## Origin:/m).slice(1)) {
    const head = section.split("\n")[0].trim().split("(")[0].trim();
    const name = head || `iteration-${names.length + 1}`;
    names.push(name);
    for (const m of section.matchAll(/^\| (\d{3}[a-z]?) \|/gim)) idToIter.set(m[1].toLowerCase(), name);
  }
  return { names, iterationOf: (id) => idToIter.get(String(id).toLowerCase()) ?? null };
}

/** @param {{ id: string, filename: string, text: string }} loaded */
export function toCorpusTask(loaded) {
  const jevText = stripDependsOnLine(loaded.text);
  return {
    id: loaded.id,
    title: extractTaskTitle(loaded.text, loaded.filename),
    files: extractFiles(jevText),
    criteria: extractAcceptanceCriteria(jevText),
    dependsOn: extractDependsOn(loaded.text),
    jevText,
  };
}

/** @param {any} a @param {any} b */
function codeEdgeOnly(a, b) {
  return certainEdge({ ...a, dependsOn: [] }, { ...b, dependsOn: [] });
}

/** @param {any} seed @returns {() => number} */
function mulberry32(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * @param {{ archiveDir?: string, archiveMd?: string, maxNegatives?: number, seed?: number }} [opts]
 */
export function buildCorpus({ archiveDir, archiveMd, maxNegatives = 60, seed = 20261001 } = {}) {
  const loaded = loadTaskFiles(archiveDir);
  const { names, iterationOf } = mapIterations(archiveMd);
  /** @type {Map<string, ReturnType<typeof toCorpusTask>[]>} */
  const byIter = new Map();
  let ungrouped = 0;
  for (const item of loaded) {
    const iter = iterationOf(item.id);
    if (!iter) {
      ungrouped++;
      continue;
    }
    if (!byIter.has(iter)) byIter.set(iter, []);
    const bucket = byIter.get(iter);
    if (bucket) bucket.push(toCorpusTask(item));
  }
  const positives = [];
  const negativePool = [];
  let declaredSkipped = 0;
  for (const tasks of byIter.values()) {
    for (let x = 0; x < tasks.length; x++) {
      for (let y = x + 1; y < tasks.length; y++) {
        const ta = tasks[x];
        const tb = tasks[y];
        const bNeedsA = tb.dependsOn.includes(ta.id);
        const aNeedsB = ta.dependsOn.includes(tb.id);
        if (bNeedsA || aNeedsB) {
          if (bNeedsA && aNeedsB) {
            declaredSkipped++;
            continue;
          }
          const first = bNeedsA ? ta : tb;
          const second = bNeedsA ? tb : ta;
          if (!codeEdgeOnly(first, second)) positives.push({ a: first, b: second });
        } else if (!codeEdgeOnly(ta, tb)) {
          negativePool.push({ a: ta, b: tb });
        }
      }
    }
  }
  const rng = mulberry32(seed);
  const shuffled = [...negativePool];
  for (let k = shuffled.length - 1; k > 0; k--) {
    const r = Math.floor(rng() * (k + 1));
    [shuffled[k], shuffled[r]] = [shuffled[r], shuffled[k]];
  }
  const negatives = shuffled.slice(0, maxNegatives);
  return {
    iterations: [...byIter.entries()].map(([name, tasks]) => ({ name, taskIds: tasks.map((t) => t.id) })),
    positives,
    negatives,
    stats: {
      taskFiles: loaded.length,
      grouped: loaded.length - ungrouped,
      ungrouped,
      iterations: names.length,
      positivePairs: positives.length,
      negativePool: negativePool.length,
      negativeSample: negatives.length,
      declaredSkipped,
    },
  };
}
