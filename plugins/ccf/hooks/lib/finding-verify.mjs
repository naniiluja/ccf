// CCF finding-verify — pure logic behind scripts/jev-verify-findings.mjs.
// Asks Jev one question per `FAIL:` finding of a /ccf:check report: "does the diff contain exactly this
// defect?". The answer ANNOTATES a finding and never removes or downgrades it: an automatic downgrade
// driven by an outside model would trade false positives for false negatives, and a missed defect costs
// far more than a second look at a doubtful one.
// Everything is pure and defensive so it is unit-testable and never throws.

import { DEFAULT_CAP_BYTES, DEFAULT_THRESHOLD, filterDiffSections, noulValue, withinSizeCap } from "./completion-evidence.mjs";

/**
 * @typedef {{ index: number, text: string, file: string | null, line: number | null, quote: string | null }} FailFinding
 */

/**
 * Every `- FAIL:` / `* FAIL:` line of a report, outside fenced code blocks (a fence holds a format
 * example, not a finding). The first `path:NN` token is the location. The quoted rule is the span after
 * the `rule:` label that 059's checker format puts on every FAIL; a description may quote other text
 * earlier on the line.
 * @param {any} reportText
 * @returns {FailFinding[]}
 */
export function parseFailFindings(reportText) {
  if (typeof reportText !== "string") return [];
  const out = [];
  let inFence = false;
  for (const raw of reportText.split(/\r?\n/)) {
    if (/^\s*```/.test(raw)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = /^\s*[-*]\s*FAIL:\s*(.*)$/.exec(raw);
    if (!m) continue;
    const text = m[1].trim();
    const loc = /`?([\w@./\\-]+\.\w+):(\d+)`?/.exec(text);
    const quote = /\brule:\s*"([^"]+)"/.exec(text) ?? (/\brepro:/.test(text) ? null : /"([^"]+)"/.exec(text));
    const repro = /\brepro:\s*"([^"]+)"\s*->\s*"([^"]*)"/.exec(text);
    out.push({
      index: out.length,
      text,
      file: loc ? loc[1] : null,
      line: loc ? Number(loc[2]) : null,
      quote: quote ? quote[1] : null,
      repro: repro ? { command: repro[1], output: repro[2] } : null,
    });
  }
  return out;
}

/**
 * @typedef {{ type: "noul", instructions: string }} NoulQuestion
 * @typedef {{
 *   ok: true,
 *   state: { diff: string, findings: { location: string | null, description: string, quoted_rule: string | null }[] },
 *   questions: Record<string, NoulQuestion>,
 *   omitted: string[],
 * } | { ok: false, reason: "no-findings" | "empty-diff" | "too-large" }} FindingRequest
 */

/**
 * Build the Jev request: the filtered diff plus the findings as state, one Noul per finding.
 * Sensitive files are stripped from the diff before anything else, and an over-cap payload is skipped
 * rather than truncated, because a cut diff would make Jev judge code it cannot see.
 * @param {any} findings output of parseFailFindings
 * @param {any} diffText unified diff of the reviewed change
 * @param {number} [capBytes]
 * @returns {FindingRequest}
 */
export function buildFindingQuestions(findings, diffText, capBytes = DEFAULT_CAP_BYTES) {
  const list = Array.isArray(findings) ? findings.filter((f) => f && typeof f === "object") : [];
  if (list.length === 0) return { ok: false, reason: "no-findings" };
  const { text: diff, omitted } = filterDiffSections(String(diffText ?? ""));
  if (diff.trim() === "") return { ok: false, reason: "empty-diff" };
  const state = {
    diff,
    findings: list.map((f) => ({
      location: f.file ? `${f.file}${f.line ? `:${f.line}` : ""}` : null,
      description: String(f.text ?? ""),
      quoted_rule: typeof f.quote === "string" ? f.quote : null,
    })),
  };
  if (!withinSizeCap(JSON.stringify(state), capBytes)) return { ok: false, reason: "too-large" };
  /** @type {Record<string, NoulQuestion>} */
  const questions = {};
  list.forEach((_, i) => {
    questions[`finding_${i + 1}`] = {
      type: "noul",
      instructions:
        `Does \`diff\` contain the defect described in \`findings[${i}]\`, at or near its location, ` +
        "and does that change actually break the rule or criterion it quotes?",
    };
  });
  return { ok: true, state, questions, omitted };
}

/**
 * @typedef {FailFinding & { marker: "FAIL:", p: number | null, verdict: "confirmed" | "not-confirmed" | "unjudged", note: string | null }} AnnotatedFinding
 */

/**
 * Attach Jev's score to each finding. The output has exactly one entry per input finding and every
 * entry keeps the `FAIL:` marker: a low score adds a note for a human, it never changes the tier.
 * @param {any} findings output of parseFailFindings
 * @param {any} answers `answers` object from the API
 * @param {number} [threshold] P(yes) at or above this is confirmed
 * @returns {AnnotatedFinding[]}
 */
export function annotateFindings(findings, answers, threshold = DEFAULT_THRESHOLD) {
  const list = Array.isArray(findings) ? findings.filter((f) => f && typeof f === "object") : [];
  const a = answers && typeof answers === "object" && !Array.isArray(answers) ? answers : {};
  return list.map((f, i) => {
    const p = noulValue(a[`finding_${i + 1}`]);
    const verdict = p === null ? "unjudged" : p >= threshold ? "confirmed" : "not-confirmed";
    const note =
      verdict === "not-confirmed"
        ? `Jev did not confirm (${p?.toFixed(2)}); needs a human look. The finding stays FAIL:.`
        : verdict === "unjudged"
          ? "Jev gave no usable answer; the finding stays FAIL:."
          : null;
    return { ...f, marker: /** @type {"FAIL:"} */ ("FAIL:"), p, verdict, note };
  });
}
