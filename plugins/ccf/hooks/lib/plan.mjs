// CCF plan helpers — shared by session-start.mjs and context-nudge.mjs.
// Reads the in-progress task from PLAN.md so both hooks can resume / hint the same task. DRY.

import { existsSync, readFileSync } from "node:fs";

/**
 * Find the first task whose STATUS cell is "in-progress" in PLAN.md's task table.
 * Row format: | 001 | Slice title | layers | gate | — | in-progress |
 * Reads id = first cell, title = second cell, status = LAST cell. Positional, so the match is on
 * the status cell only (not anywhere the words "in progress" appear in prose or a title).
 * @param {string} file path to PLAN.md
 * @returns {{ id: string, title: string } | null}
 */
export function findInProgressTask(file) {
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
    if (!/^in[-\s]?progress$/i.test(status)) continue; // STATUS cell only, whole-cell match
    return { id: cells[0], title: cells[1] };
  }
  return null;
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
