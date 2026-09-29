// CCF completion-evidence helpers — pure logic behind the opt-in completion-evidence Stop hook.
// The hook asks Jev (TypeSafe) whether a task's diff and test output meet its acceptance criteria.
// Everything here is pure and defensive so it is unit-testable with `node --test` and never throws;
// the I/O (git, transcript, network, stdout) lives in the hook, per the hooks.md split.
//
// Privacy note: the diff leaves the machine. Sensitive paths are stripped before anything is sent,
// and an oversize payload is SKIPPED, never truncated (a cut diff makes Jev judge code it cannot see).

import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** P(yes) cut-off below which a criterion counts as unmet. Task 057 measured it on 36 real cases: 0.6 caught one more unmet claim than 0.5 at the same false-alarm count, a one-item gap, so 0.5 was kept. */
export const DEFAULT_THRESHOLD = 0.5;

/**
 * Payload cap in bytes of serialized state. Measured live (task 057): the API rejects a request with
 * `max_tokens_exceeded` (HTTP 400) above roughly 33K input tokens, about 110KB of source at 3.4 bytes per
 * token but less for denser text, so 80KB leaves headroom. Docs state no limit.
 */
export const DEFAULT_CAP_BYTES = 80_000;

/**
 * Pull the checkbox items out of a task file's "Acceptance criteria" section.
 * Only top-level `- [ ]` / `- [x]` lines count; the section ends at the next `## ` heading.
 * @param {string} text task file contents
 * @returns {string[]} criterion text, marker removed
 */
export function extractAcceptanceCriteria(text) {
  if (typeof text !== "string") return [];
  const out = [];
  let inSection = false;
  for (const line of text.split(/\r?\n/)) {
    if (/^##\s+/.test(line)) {
      inSection = /^##\s+acceptance criteria\b/i.test(line);
      continue;
    }
    if (!inSection) continue;
    const m = /^- \[[ xX]\]\s+(.+?)\s*$/.exec(line);
    if (m) out.push(m[1]);
  }
  return out;
}

const SENSITIVE_NAME = /(^\.env)|(\.pem$)|(\.key$)|(\.p12$)|(\.pfx$)|(^id_rsa)|(^\.npmrc$)|(^\.netrc$)|(^settings(\.local)?\.json$)|credential|secret/i;
const SENSITIVE_DIR = /^secrets?$/i;

/**
 * True when a path looks like it holds a secret (env files, private keys, credential stores, Claude
 * settings that may carry an `env` block, anything under a `secrets/` directory).
 * Over-matching (e.g. `secretary.js`) is the safe direction.
 * @param {string} path
 * @returns {boolean}
 */
export function isSensitivePath(path) {
  if (typeof path !== "string") return false;
  const parts = path.split(/[\\/]/);
  const name = parts.pop() ?? "";
  return SENSITIVE_NAME.test(name) || parts.some((seg) => SENSITIVE_DIR.test(seg));
}

/**
 * Drop whole `diff --git` sections whose file is sensitive.
 * @param {string} diffText unified diff
 * @returns {{ text: string, omitted: string[] }}
 */
export function filterDiffSections(diffText) {
  if (typeof diffText !== "string" || diffText === "") return { text: "", omitted: [] };
  const lines = diffText.split("\n");
  /** @type {string[]} */
  const kept = [];
  /** @type {string[]} */
  const omitted = [];
  let dropping = false;
  for (const line of lines) {
    if (line.startsWith("diff --git ")) {
      // Fail closed: a header we cannot parse is dropped, because the only thing between a secret
      // and the network is this name check. Git quotes names with non-ASCII bytes by default.
      const rest = line.slice("diff --git ".length);
      const m = /^"a\/(.*)" "b\/(.*)"$/.exec(rest) ?? /^a\/(.+?) b\/(.+)$/.exec(rest);
      // Git diff paths always use "/", so a backslash here is a quote escape (`\303\251`), not a
      // separator: strip it before matching, or `secret_\303\251.json` would basename to `251.json`.
      const hit = (/** @type {string} */ p) => isSensitivePath(p) || isSensitivePath(p.replace(/\\/g, ""));
      dropping = !m || hit(m[1]) || hit(m[2]);
      if (dropping) omitted.push(m ? m[2] : "(unparsed diff header)");
    }
    if (!dropping) kept.push(line);
  }
  return { text: kept.join("\n"), omitted };
}

/**
 * True when `text` fits within `capBytes` UTF-8 bytes (boundary inclusive).
 * @param {string} text
 * @param {number} capBytes
 * @returns {boolean}
 */
export function withinSizeCap(text, capBytes) {
  if (typeof text !== "string" || typeof capBytes !== "number" || !(capBytes >= 0)) return false;
  return Buffer.byteLength(text, "utf8") <= capBytes;
}

/**
 * @typedef {{ type: "noul", instructions: string }} NoulQuestion
 * @typedef {{
 *   ok: true,
 *   state: { task: { id: string, title: string, acceptance_criteria: string[] }, diff: string, test_output: string },
 *   questions: Record<string, NoulQuestion>,
 *   omitted: string[],
 * } | { ok: false, reason: "no-criteria" | "empty-diff" | "too-large" | "bad-input" }} EvidenceRequest
 */

/**
 * Build the Jev request for one task: named state fields, one Noul per criterion, one scope-creep Noul.
 * Skips (returns `ok:false`) instead of sending anything questionable.
 * @param {{ task?: { id?: string, title?: string }, criteria?: string[], diff?: string, testOutput?: string, capBytes?: number }} input
 * @returns {EvidenceRequest}
 */
export function buildEvidenceRequest(input) {
  try {
    if (!input || typeof input !== "object") return { ok: false, reason: "bad-input" };
    const criteria = Array.isArray(input.criteria) ? input.criteria.filter((c) => typeof c === "string" && c) : [];
    if (criteria.length === 0) return { ok: false, reason: "no-criteria" };
    const { text: diff, omitted } = filterDiffSections(String(input.diff ?? ""));
    if (diff.trim() === "") return { ok: false, reason: "empty-diff" };
    const state = {
      task: {
        id: String(input.task?.id ?? ""),
        title: String(input.task?.title ?? ""),
        acceptance_criteria: criteria,
      },
      diff,
      test_output: String(input.testOutput ?? ""),
    };
    const cap = typeof input.capBytes === "number" ? input.capBytes : DEFAULT_CAP_BYTES;
    if (!withinSizeCap(JSON.stringify(state), cap)) return { ok: false, reason: "too-large" };
    /** @type {Record<string, NoulQuestion>} */
    const questions = {};
    criteria.forEach((c, i) => {
      questions[`criterion_${i + 1}`] = {
        type: "noul",
        instructions: `Based on \`diff\` and \`test_output\`, is this acceptance criterion of the task met: ${c}`,
      };
    });
    questions.scope_creep = {
      type: "noul",
      instructions:
        "Does `diff` contain changes that are unrelated to the goal and acceptance criteria in `task`, such as unrequested refactors or extra features?",
    };
    return { ok: true, state, questions, omitted };
  } catch {
    return { ok: false, reason: "bad-input" };
  }
}

/**
 * A usable Noul probability: a finite number in 0..1.
 * @param {any} answer
 * @returns {number | null}
 */
export function noulValue(answer) {
  const v = answer?.noul;
  return typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1 ? v : null;
}

/**
 * Turn Jev's answers into the criteria that were not shown to be met.
 * A missing or malformed answer is `unjudged`, never counted as met.
 * @param {Record<string, any>} answers `answers` object from the API
 * @param {string[]} criteria the criteria, in the order the questions were built
 * @param {number} [threshold] P(yes) below this is unmet; at or above it is met
 * @returns {{ unmet: string[], unjudged: string[], scopeCreep: boolean }}
 */
export function unmetCriteria(answers, criteria, threshold = DEFAULT_THRESHOLD) {
  const a = answers && typeof answers === "object" && !Array.isArray(answers) ? answers : {};
  const list = Array.isArray(criteria) ? criteria : [];
  /** @type {string[]} */
  const unmet = [];
  /** @type {string[]} */
  const unjudged = [];
  list.forEach((c, i) => {
    const v = noulValue(a[`criterion_${i + 1}`]);
    if (v === null) unjudged.push(c);
    else if (v < threshold) unmet.push(c);
  });
  const scope = noulValue(a.scope_creep);
  return { unmet, unjudged, scopeCreep: scope !== null && scope >= threshold };
}

/**
 * Compose the advisory text, or "" when there is nothing to report (the hook then stays silent).
 * @param {{ task: { id: string, title: string }, unmet: string[], unjudged: string[], scopeCreep: boolean, omitted: string[] }} r
 * @returns {string}
 */
export function formatAdvisory(r) {
  if (!r || (r.unmet.length === 0 && r.unjudged.length === 0 && !r.scopeCreep)) return "";
  const lines = [`CCF completion-evidence (Jev, advisory): task ${r.task.id} (${r.task.title}) may not be complete yet.`];
  if (r.unmet.length) lines.push(`Criteria not shown to be met: ${r.unmet.map((c) => `"${c}"`).join("; ")}.`);
  if (r.unjudged.length) lines.push(`Not judged (no usable answer): ${r.unjudged.map((c) => `"${c}"`).join("; ")}.`);
  if (r.scopeCreep) lines.push("The diff may contain changes beyond the task goal.");
  if (r.omitted.length) lines.push(`Files left out of what was sent: ${r.omitted.join(", ")}.`);
  lines.push("Advisory only; run /ccf:check before /ccf:updatespec marks the task done.");
  return lines.join(" ");
}

/**
 * The output of the LAST test command run this session (transcript records, role-gated: a shell
 * `tool_use` from `assistant`, its `tool_result` from `user`). Keeps the tail when over `maxChars`
 * because test summaries print last. Returns "" on any doubt.
 * @param {any} records parsed transcript records
 * @param {(command: string) => boolean} isTestCommand
 * @param {number} [maxChars]
 * @returns {string}
 */
export function lastTestOutput(records, isTestCommand, maxChars = 8000) {
  try {
    if (!Array.isArray(records)) return "";
    const SHELL = new Set(["bash", "shell", "powershell", "pwsh"]);
    /** @type {Set<string>} */
    const testIds = new Set();
    let last = "";
    for (const rec of records) {
      const content = rec?.message?.content;
      if (!Array.isArray(content)) continue;
      for (const block of content) {
        if (rec.type === "assistant" && block?.type === "tool_use") {
          if (SHELL.has(String(block.name ?? "").toLowerCase()) && isTestCommand(String(block.input?.command ?? ""))) {
            testIds.add(String(block.id ?? ""));
          }
        } else if (rec.type === "user" && block?.type === "tool_result" && testIds.has(String(block.tool_use_id ?? ""))) {
          const c = block.content;
          last = typeof c === "string" ? c : Array.isArray(c) ? c.map((b) => String(b?.text ?? "")).join("") : "";
        }
      }
    }
    return last.length > maxChars ? last.slice(-maxChars) : last;
  } catch {
    return "";
  }
}

/**
 * Render a new (untracked) file as a `diff --git` section so it flows through the same sensitive-path
 * filter as tracked changes. Binary-looking content (a NUL byte) and non-strings give "".
 * @param {any} path repo-relative path
 * @param {any} content file text
 * @returns {string}
 */
export function untrackedAsDiff(path, content) {
  if (typeof path !== "string" || !path || typeof content !== "string" || content.includes("\u0000")) return "";
  const body = content.split("\n").map((l) => `+${l}`).join("\n");
  return `diff --git a/${path} b/${path}\nnew file mode 100644\n--- /dev/null\n+++ b/${path}\n${body}\n`;
}

/**
 * Marker file that records "Jev was already asked about this exact task + diff", so repeated Stops
 * do not pay for the same question. Keyed on a hash only: the name is always a plain file name.
 * @param {any} taskId
 * @param {any} diff
 * @returns {string}
 */
export function evidenceMarkerPath(taskId, diff) {
  const h = createHash("sha256").update(`${String(taskId ?? "")}\n${String(diff ?? "")}`).digest("hex").slice(0, 16);
  return join(tmpdir(), `ccf-jev-${h}`);
}