// CCF plan helpers — shared by session-start.mjs and context-guard.mjs.
// Reads the active task (in-progress OR in-review) from PLAN.md so both hooks can resume / hint the same task. DRY.

import { existsSync, readFileSync } from "node:fs";

/**
 * Find the first ACTIVE task (status cell "in-progress" OR "in-review") in PLAN.md's task table.
 * Row format: | 001 | Slice title | layers | gate | — | in-progress |
 * id = first cell, title = second cell, status = resolved dynamically per table — see
 * collectTaskRows (NOT assumed to be the last cell; a real-world table may put another column,
 * e.g. Predecessor, after Status). Both statuses are reloadable: an `in-review` task is still the
 * task you are on (awaiting /ccf:check + review).
 * @param {string} file path to PLAN.md
 * @returns {{ id: string, title: string } | null}
 */
export function findActiveTask(file) {
  if (!existsSync(file)) return null;
  let content;
  try {
    content = readFileSync(file, "utf8");
  } catch {
    return null;
  }
  for (const row of collectTaskRows(content.split(/\r?\n/))) {
    if (/^in[-\s]?(progress|review)$/i.test(row.status)) return { id: row.id, title: row.title };
  }
  return null;
}

// Terminal statuses: a task in one of these is CLOSED — no further action needed, so it must not
// nag the not-done nudge forever. "done" is CCF's own lifecycle terminus; "dropped" (and common
// synonyms) is a real-world addition seen in production PLAN.md files for a task deliberately
// abandoned by decision (e.g. "wang chốt BỎ — cơ chế retry không tồn tại") — that is a closed
// decision, not oversight, and is distinct from "blocked" (still open, waiting on something).
const CLOSED_STATUS_RE = /^(done|dropped|cancell?ed|won'?t[-\s]?fix|wontfix)$/i;

/**
 * True when a status cell means the task is CLOSED (see CLOSED_STATUS_RE). Exported so
 * `archive.mjs` decides "iteration fully closed" against the SAME definition the Stop nudge uses
 * for "still live work" — if the two ever diverged, an iteration could be archived while the nudge
 * still counted its rows as open (or vice-versa). One source of truth, deliberately.
 * @param {string} status status cell text (already emphasis-stripped by collectTaskRows)
 * @returns {boolean}
 */
export function isClosedStatus(status) {
  return CLOSED_STATUS_RE.test(status);
}

/**
 * True when a parsed row is a REAL task row rather than a table header that slipped through.
 * Backup guard (defense-in-depth): a header row with no following separator row (malformed table,
 * so isHeaderRow inside collectTaskRows already missed it) still won't leak IF its resolved status
 * literally reads "Status" or its id cell is the near-universal "#" marker used for an id column
 * header — both harmless no-ops on a real task. Shared by findNonDoneTasks and archive.mjs.
 * @param {{ id: string, status: string }} row
 * @returns {boolean}
 */
export function isRealTaskRow(row) {
  return !/^status$/i.test(row.status) && row.id !== "#";
}

/**
 * Strip markdown emphasis wrappers (`**bold**`, `*italic*`, `_italic_`, `` `code` ``) from a status
 * cell. Emphasis is PRESENTATION, not data, and every status predicate in this file is ANCHORED
 * (`^done$`, `^in-review$`) — so a decorated cell silently fails to match and a finished task reads
 * as open. Not hypothetical: this repo's own PLAN.md wrote `| 036 | … | **done** |` to visually
 * stress the status, and the Stop nudge's clause C then reported 036/037 among the "not done" tasks.
 * Only the OUTER runs are removed, so a hyphenated status (`in-review`) or one containing an inner
 * underscore is untouched. Deliberately NOT applied to the id/title cells: the status is the only
 * field compared against anchored predicates, the others are just displayed (YAGNI).
 * @param {string} cell raw status cell text
 * @returns {string} the status with surrounding emphasis/whitespace removed
 */
function stripEmphasis(cell) {
  return cell.replace(/^[*_`\s]+/, "").replace(/[*_`\s]+$/, "");
}

/**
 * Find every task row whose status cell is NOT a closed status (see CLOSED_STATUS_RE) — i.e.
 * todo / in-progress / in-review / blocked / any other open status.
 * id/title/status come from collectTaskRows (status column resolved dynamically, not assumed
 * last). Best-effort: missing/unreadable file → `[]`, never throws.
 * @param {string} file path to PLAN.md
 * @returns {{ id: string, title: string, status: string }[]}
 */
export function findNonDoneTasks(file) {
  if (!existsSync(file)) return [];
  let content;
  try {
    content = readFileSync(file, "utf8");
  } catch {
    return [];
  }
  return collectTaskRows(content.split(/\r?\n/)).filter(
    (row) => isRealTaskRow(row) && !isClosedStatus(row.status), // only collect rows that are still OPEN
  );
}

/**
 * Walk PLAN.md's lines and yield every real task row as `{ id, title, status }`, resolving the
 * STATUS column dynamically per table section instead of assuming it is always the last column.
 * Real-world PLAN.md tables vary column order — e.g. `| # | Task | Status | Predecessor |` puts
 * Predecessor AFTER Status — so hardcoding "status = last cell" silently reads the Predecessor
 * value (a task id or "—") as the status for every row, making EVERY row look "not done" even
 * when the real Status column says "done" (the reported bug). On each header row (detected
 * structurally via isHeaderRow, so it works regardless of header wording/language), this looks
 * for a cell that reads exactly "status" (case-insensitive) and uses THAT index for every row in
 * the section that follows; if no header cell matches, falls back to the last-cell heuristic
 * (previous behavior) for that section, so a table with no recognisable header still parses.
 * id = first cell, title = second cell — unaffected, both projects observed use that order.
 * Exported for `archive.mjs`, which parses the SAME tables but scoped to one iteration's line range.
 * @param {string[]} lines all lines of the file
 * @returns {{ id: string, title: string, status: string }[]}
 */
export function collectTaskRows(lines) {
  /** @type {{ id: string, title: string, status: string }[]} */
  const rows = [];
  /** @type {number | null} column index of "Status" in the current table section; null = last cell */
  let statusCol = null;
  for (let i = 0; i < lines.length; i++) {
    const cells = parseTableRow(lines[i]);
    if (!cells || cells.length < 3) continue; // need at least id | title | status
    if (isHeaderRow(lines, i)) {
      const idx = cells.findIndex((c) => /^status$/i.test(c));
      statusCol = idx >= 0 ? idx : null;
      continue;
    }
    const rawStatus = statusCol !== null && statusCol < cells.length ? cells[statusCol] : cells[cells.length - 1];
    // Normalize ONCE here, at the single place every row is produced, so both findActiveTask and
    // findNonDoneTasks (and anything reading the returned `status`) see clean data — DRY.
    rows.push({ id: cells[0], title: cells[1], status: stripEmphasis(rawStatus) });
  }
  return rows;
}

/**
 * Pick the task to reference in a /compact hint (context-guard). Prefers the truly ACTIVE task
 * (in-progress or in-review — same definition as findActiveTask) so the hint names concrete work
 * whenever such work exists; falls back to the first not-yet-started ("todo") task so the hint
 * stays task-specific even in the gap between finishing one task and starting the next, rather
 * than silently degrading to the generic wording just because nothing is currently in-progress.
 * @param {string} file path to PLAN.md
 * @returns {{ id: string, title: string } | null}
 */
export function findHintTask(file) {
  const active = findActiveTask(file);
  if (active) return active;
  const nextTodo = findNonDoneTasks(file).find((t) => /^todo$/i.test(t.status));
  return nextTodo ? { id: nextTodo.id, title: nextTodo.title } : null;
}

/**
 * True when the table row at `lines[i]` is a HEADER row — detected structurally by CommonMark
 * table syntax (a header row is always immediately followed by a `|---|---|` separator row), NOT
 * by matching literal English header text. This is language-agnostic: it correctly skips a header
 * whose last cell reads "Status", "Trạng thái", or anything else, as long as the table follows
 * standard markdown table syntax. A malformed table with no separator row falls back to the
 * literal-text guards in findNonDoneTasks (defense-in-depth, not the primary mechanism).
 * @param {string[]} lines all lines of the file
 * @param {number} i index of the candidate row
 * @returns {boolean}
 */
function isHeaderRow(lines, i) {
  const nextLine = lines[i + 1];
  if (nextLine === undefined) return false;
  const nextCells = splitRowCells(nextLine);
  return !!nextCells && isSeparatorRow(nextCells);
}

/**
 * Split a raw markdown table row line into trimmed positional cells (still pipe-escaped), or null
 * if the line is not a table row at all. Shared by parseTableRow and isHeaderRow so the "what even
 * is a row" logic lives in one place (DRY).
 * @param {string} line
 * @returns {string[] | null}
 */
function splitRowCells(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|")) return null; // a real table row starts with a pipe
  // Split on unescaped pipes only, so a `\|` inside a cell is not treated as a column boundary.
  const raw = trimmed.split(/(?<!\\)\|/);
  raw.shift();
  raw.pop();
  return raw.map((c) => c.trim());
}

/**
 * True when `cells` (already split, still pipe-escaped) form a markdown header-separator row, i.e.
 * every cell is only dashes/colons (`---`, `:--`, `--:`, `:-:`) or empty.
 * @param {string[]} cells
 * @returns {boolean}
 */
function isSeparatorRow(cells) {
  return cells.length > 0 && cells.every((c) => /^:?-{2,}:?$/.test(c) || c === "");
}

/**
 * Parse one markdown table row into positional cell values, or null if the line is not a row.
 * Keeps empty cells (so columns don't shift) and un-escapes `\|` inside cells. Skips the
 * header separator row (e.g. `| --- | --- |`).
 * @param {string} line a single line of the file
 * @returns {string[] | null}
 */
function parseTableRow(line) {
  const raw = splitRowCells(line);
  if (!raw) return null;
  if (isSeparatorRow(raw)) return null; // skip the markdown header separator row itself
  return raw.map((c) => c.replace(/\\\|/g, "|")); // un-escape `\|` inside a cell
}
