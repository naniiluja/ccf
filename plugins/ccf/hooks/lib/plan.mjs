// CCF plan helpers — shared by session-start.mjs and context-guard.mjs.
// Reads the active task (in-progress OR in-review) from PLAN.md so both hooks can resume / hint the same task. DRY.

import { existsSync, readFileSync } from "node:fs";

/**
 * Find the first ACTIVE task (status cell "in-progress" OR "in-review") in PLAN.md's task table.
 * Row format: | 001 | Slice title | layers | gate | — | in-progress |
 * Reads id = first cell, title = second cell, status = LAST cell. Positional, so the match is on
 * the status cell only (not anywhere the words "in progress"/"in review" appear in prose or a title).
 * Both are reloadable: an `in-review` task is still the task you are on (awaiting /ccf-check + review).
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
  for (const line of content.split(/\r?\n/)) {
    const cells = parseTableRow(line);
    if (!cells || cells.length < 3) continue; // need at least id | title | status
    const status = cells[cells.length - 1];
    if (!/^in[-\s]?(progress|review)$/i.test(status)) continue; // STATUS cell only, whole-cell match
    return { id: cells[0], title: cells[1] };
  }
  return null;
}

/**
 * Find every task row whose status cell is NOT "done" (todo / in-progress / in-review / blocked).
 * Positional like findActiveTask: id = first cell, title = second cell, status = LAST cell — so the
 * match is on the status cell only, never on the words appearing in a title or prose. Skips the
 * header + separator rows via parseTableRow. Best-effort: missing/unreadable file → `[]`, never throws.
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
  /** @type {{ id: string, title: string, status: string }[]} */
  const out = [];
  for (const line of content.split(/\r?\n/)) {
    const cells = parseTableRow(line);
    if (!cells || cells.length < 3) continue; // need at least id | title | status
    const status = cells[cells.length - 1];
    // Skip the header row (its status cell is the literal column label "Status", never a task).
    if (/^status$/i.test(status)) continue;
    if (/^done$/i.test(status)) continue; // only collect rows NOT yet done
    out.push({ id: cells[0], title: cells[1], status });
  }
  return out;
}

/**
 * Parse one markdown table row into positional cell values, or null if the line is not a row.
 * Keeps empty cells (so columns don't shift) and un-escapes `\|` inside cells. Skips the
 * header separator row (e.g. `| --- | --- |`).
 * @param {string} line a single line of the file
 * @returns {string[] | null}
 */
function parseTableRow(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|")) return null; // a real table row starts with a pipe
  // Split on unescaped pipes only, so a `\|` inside a cell is not treated as a column boundary.
  const raw = trimmed.split(/(?<!\\)\|/);
  // Leading/trailing pipe produce empty edge fields — drop exactly those two edges.
  raw.shift();
  raw.pop();
  const cells = raw.map((c) => c.trim().replace(/\\\|/g, "|"));
  // Skip the markdown header separator row (cells are only dashes/colons).
  if (cells.length > 0 && cells.every((c) => /^:?-{2,}:?$/.test(c) || c === "")) return null;
  return cells;
}
