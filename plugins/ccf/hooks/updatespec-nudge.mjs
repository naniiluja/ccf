#!/usr/bin/env node
// CCF updatespec nudge — Stop event, PURELY ADVISORY (never blocks).
// If code changed more recently than the spec, nudge to run /ccf-check then /ccf-updatespec.

import { existsSync } from "node:fs";
import { join } from "node:path";
import { readStdinJson, emitContext } from "./lib/io.mjs";
import { specsOlderThanCode } from "./lib/freshness.mjs";

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

if (specsOlderThanCode(cwd, rulesDir)) {
  emitContext(
    "Stop",
    "<ccf>Code changed this session but the spec wasn't updated. " +
      "Consider running /ccf:ccf-check then /ccf:ccf-updatespec to keep context fresh for future sessions.</ccf>",
  );
}

process.exit(0);
