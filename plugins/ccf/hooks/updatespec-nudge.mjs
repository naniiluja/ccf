#!/usr/bin/env node
// CCF updatespec nudge — Stop event, PURELY ADVISORY (never blocks).
// If code changed more recently than the spec, nudge to run /ccf-check then /ccf-updatespec.

import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { readStdinJson, emitContext } from "./lib/io.mjs";

const input = await readStdinJson();

// Avoid loops: if this Stop was triggered by a previous Stop hook, bail out.
if (input.stop_hook_active) {
  process.exit(0);
}

const cwd = String(input.cwd ?? process.cwd());
const rulesDir = join(cwd, ".claude", "rules");

// Only nudge for CCF-managed projects (those with .claude/rules).
if (!existsSync(rulesDir)) {
  process.exit(0);
}

if (codeNewerThanSpec(cwd, rulesDir)) {
  emitContext(
    "Stop",
    "<ccf>Code changed this session but the spec wasn't updated. " +
      "Consider running /ccf:ccf-check then /ccf:ccf-updatespec to keep context fresh for future sessions.</ccf>",
  );
}

process.exit(0);

// ----------------------------------------------------------------------------

/**
 * @param {string} root
 * @param {string} rules
 */
function codeNewerThanSpec(root, rules) {
  const specMtime = newestMtime(rules, 1);
  if (specMtime === 0) return false;
  const srcDirs = ["src", "be", "fe", "app", "lib", "packages"].map((d) => join(root, d));
  let codeMtime = 0;
  for (const d of srcDirs) {
    if (existsSync(d)) codeMtime = Math.max(codeMtime, newestMtime(d, 2));
  }
  return codeMtime > specMtime;
}

/**
 * @param {string} dir
 * @param {number} depth
 * @returns {number}
 */
function newestMtime(dir, depth) {
  let newest = 0;
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const e of entries) {
    if (e.name === "node_modules" || e.name === ".git") continue;
    const full = join(dir, e.name);
    try {
      if (e.isDirectory()) {
        if (depth > 0) newest = Math.max(newest, newestMtime(full, depth - 1));
      } else {
        newest = Math.max(newest, statSync(full).mtimeMs);
      }
    } catch {
      // skip
    }
  }
  return newest;
}
