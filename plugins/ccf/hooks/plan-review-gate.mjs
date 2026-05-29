#!/usr/bin/env node
// CCF plan-review gate — enforces that a /ccf-plan session reviews its plan before presenting it.
// Event: PreToolUse, matcher ExitPlanMode (the tool that surfaces the plan for user approval).
// Deterministic mechanism: read the transcript best-effort; if this IS a /ccf-plan session and no
// ccf-spec-checker review has run yet → deny ExitPlanMode (permissionDecision) with guidance.
// Best-effort: the transcript .jsonl shape is undocumented, so ANY read/parse failure → allow
// (never block a non-CCF or unreadable session). This is the deterministic backbone; ccf-plan's
// step 6 prompt is the defense-in-depth backup layer.

import { existsSync, readFileSync } from "node:fs";
import { readStdinJson, denyTool } from "./lib/io.mjs";
import { parseJsonl, hasCcfPlanCommand, hasSpecCheckerReview } from "./lib/review-trace.mjs";

const input = await readStdinJson();

const transcriptPath = String(input.transcript_path ?? "");
if (!transcriptPath || !existsSync(transcriptPath)) process.exit(0); // can't read → allow

let raw;
try {
  raw = readFileSync(transcriptPath, "utf8");
} catch {
  process.exit(0); // unreadable → allow
}

const records = parseJsonl(raw);

// Scope: only enforce inside a /ccf-plan session; leave every other ExitPlanMode untouched.
if (!hasCcfPlanCommand(records)) process.exit(0);

if (hasSpecCheckerReview(records)) process.exit(0); // already reviewed → allow

denyTool(
  "CCF: this plan has not been reviewed yet. Before calling ExitPlanMode, delegate a fresh-context " +
    "ccf-spec-checker subagent in plan-review mode (read-only, via Task) to critique the plan " +
    "(vertical slicing, real gates, one predecessor, spec drift), fold its critique back into the " +
    "plan, then call ExitPlanMode again.",
);
