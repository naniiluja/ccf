// CCF plan-archive decisions. Every decision is a PURE function over lines; the single exception is
// findRetirableIterationsIn, a thin defensive path-taking reader for hook callers (matching how
// plan.mjs exposes findActiveTask/findNonDoneTasks by path). No function here WRITES anything.
// Shared by scripts/archive-plan.mjs (which performs the file writes) and updatespec-nudge.mjs
// clause (D) (which only detects and nudges). Keeping the decision here means the hook that NOTICES
// a retirable iteration and the script that RETIRES it can never disagree about "fully closed".
//
// WHY POSITIONAL GROUPING, not name matching: an iteration spans several `##` sections (Origin,
// Task backlog, Closed) whose headings do NOT share a common name in practice. Real headings from
// this repo's own ARCHIVE.md: `## Origin — bestpractice-audit → advisor+goal docs → SubagentStop
// verify-gate (…)` sits above `## Task backlog — bestpractice-audit + advisor/goal +
// SubagentStop-gate`, and another iteration's backlog heading is the bare `## Task backlog (in
// execution order)` with no name at all. Grouping by "heading contains the iteration name" would
// mis-assign or orphan those sections and cut the wrong lines out of the file. So an iteration is
// defined by POSITION: everything from one `## Origin` heading up to the next one (or EOF).

import { existsSync, readFileSync } from "node:fs";
import { collectTaskRows, isClosedStatus, isRealTaskRow } from "./plan.mjs";

/** A `## Origin …` heading — the only structural marker that starts an iteration. */
const ORIGIN_HEADING_RE = /^##\s+Origin\b/i;

/** A task id that maps to a `task-<id>-*.md` file: digits, optionally suffixed (e.g. `024a`). */
const TASK_ID_RE = /^\d+[a-z]?$/i;

/**
 * @typedef {object} Iteration
 * @property {string} heading the trimmed `## Origin …` heading line, for display
 * @property {number} start index of the heading line (inclusive)
 * @property {number} end index one past the iteration's last line (exclusive)
 * @property {string[]} lines the iteration's raw lines, verbatim
 * @property {{ id: string, title: string, status: string }[]} rows its task-table rows
 */

/**
 * Split a plan/archive file into iterations, each spanning from one `## Origin` heading to the next.
 * Content before the first `## Origin` (title, preamble blockquotes, general notes) belongs to no
 * iteration and is therefore never touched by a retirement.
 * Headings inside a fenced code block are ignored, so a doc example showing `## Origin …` cannot be
 * mistaken for a real iteration.
 * @param {string[]} lines all lines of the file
 * @returns {Iteration[]} in file order (this project writes newest-first, but that is not assumed)
 */
export function parseIterations(lines) {
  /** @type {number[]} */
  const originIndexes = [];
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith("```") || trimmed.startsWith("~~~")) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    if (ORIGIN_HEADING_RE.test(lines[i])) originIndexes.push(i);
  }
  return originIndexes.map((start, n) => {
    const end = n + 1 < originIndexes.length ? originIndexes[n + 1] : lines.length;
    const own = lines.slice(start, end);
    return {
      heading: lines[start].trim(),
      start,
      end,
      lines: own,
      rows: collectTaskRows(own).filter(isRealTaskRow),
    };
  });
}

/**
 * True when an iteration may be retired: it has at least one task row AND every row is CLOSED
 * (`isClosedStatus` — the same predicate the Stop nudge uses to decide a row is NOT live work).
 * The `rows.length > 0` half is load-bearing, not defensive noise: `[].every(...)` is vacuously
 * true, so without it a brand-new iteration whose backlog table has not been written yet would
 * read as "fully closed" and get archived on the spot, deleting live work.
 * @param {Iteration} iteration
 * @returns {boolean}
 */
export function isRetirable(iteration) {
  return iteration.rows.length > 0 && iteration.rows.every((row) => isClosedStatus(row.status));
}

/**
 * Every iteration in `lines` that is ready to be retired.
 * @param {string[]} lines all lines of PLAN.md
 * @returns {Iteration[]}
 */
export function findRetirableIterations(lines) {
  return parseIterations(lines).filter(isRetirable);
}

/**
 * Same as findRetirableIterations but taking a PATH, for hook callers that only want the detection.
 * Best-effort by design: a missing or unreadable PLAN.md yields `[]`, never a throw — a Stop hook
 * must not break a session over a nudge it could not compute.
 * @param {string} file path to PLAN.md
 * @returns {Iteration[]}
 */
export function findRetirableIterationsIn(file) {
  if (!existsSync(file)) return [];
  try {
    return findRetirableIterations(readFileSync(file, "utf8").split(/\r?\n/));
  } catch {
    return [];
  }
}

/**
 * Compute the two rewrites a retirement needs, without performing either.
 * `archiveEntry` is the iteration's text VERBATIM — deliberately not tidied, because the archive's
 * value is that it is an auditable record (a heading still reading `OPEN` next to a `done` row is
 * itself part of the history).
 * @param {string[]} lines all lines of PLAN.md
 * @param {Iteration} iteration the iteration to retire
 * @returns {{ planText: string, archiveEntry: string, taskIds: string[] }}
 */
export function retirePlan(lines, iteration) {
  const remaining = [...lines.slice(0, iteration.start), ...lines.slice(iteration.end)];
  return {
    planText: endWithSingleNewline(remaining.join("\n")),
    archiveEntry: iteration.lines.join("\n").replace(/\s+$/, ""),
    taskIds: iteration.rows.map((row) => row.id).filter((id) => TASK_ID_RE.test(id)),
  };
}

/**
 * Insert a retired iteration's text into an archive file, newest first.
 * Placed just before the archive's FIRST `## Origin` heading, so any general preamble above the
 * iteration list (title, reading caveats, a cross-iteration risk note) keeps its position at the
 * top. An archive with no iteration yet gets the entry appended after its preamble.
 * @param {string} archiveContent current ARCHIVE.md content ("" when the file does not exist yet)
 * @param {string} entryText the iteration text from retirePlan().archiveEntry
 * @returns {string} the full new archive content
 */
export function insertIntoArchive(archiveContent, entryText) {
  const entry = String(entryText ?? "").replace(/\s+$/, "");
  const lines = String(archiveContent ?? "").split(/\r?\n/);
  let inFence = false;
  let insertAt = -1;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith("```") || trimmed.startsWith("~~~")) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    if (ORIGIN_HEADING_RE.test(lines[i])) {
      insertAt = i;
      break;
    }
  }
  if (insertAt >= 0) {
    return endWithSingleNewline([...lines.slice(0, insertAt), entry, "", ...lines.slice(insertAt)].join("\n"));
  }
  // No iteration yet: append after the preamble, dropping its trailing blank lines first so the
  // separation is exactly one blank line regardless of how the existing file ended.
  const head = [...lines];
  while (head.length > 0 && head[head.length - 1].trim() === "") head.pop();
  const joined = head.length > 0 ? [...head, "", entry].join("\n") : entry;
  return endWithSingleNewline(joined);
}

/**
 * Normalize a file's ending to exactly one trailing newline (POSIX text-file convention), so
 * repeated retirements don't accumulate blank lines at EOF.
 * @param {string} text
 * @returns {string}
 */
function endWithSingleNewline(text) {
  return `${text.replace(/\s+$/, "")}\n`;
}
