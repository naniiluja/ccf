#!/usr/bin/env node
// CCF implementer-verify-gate — SubagentStop event, OPT-IN (default no-op), matcher ccf-implementer.
// Mechanism: blocks a spawned ccf-implementer from stopping when its final message carries no
// TEST-RESULT evidence (per the pinned Return format in agents/ccf-implementer.md) — a defensive
// backstop for the failing-test-first law, independent of the main-loop auto-verify.mjs.
// Opt-in: only fires when its hooks.json command carries `--enforce-tests` (no arg → exit 0
// silently), the same toggle pattern as auto-verify's `--auto-verify` / context-guard's `--hard-block`.
// Message source: trusts the DOCUMENTED SubagentStop field `last_assistant_message` first (grounded
// via code.claude.com/docs/en/hooks + /sub-agents); `transcript_path` is NOT documented for this event,
// so it is only a defensive FALLBACK for harnesses that supply a transcript instead of the message
// field directly (task 034; 034a observes the real payload). Does NOT reuse `blockStop` (a different
// event's output shape) blindly.
// Best-effort: any error → exit 0 (we MUST never break a subagent run).

import { existsSync, readFileSync } from "node:fs";
import { readStdinJson, blockSubagentStop } from "./lib/io.mjs";
import { parseJsonl } from "./lib/review-trace.mjs";
import {
  shouldBlockImplementerStop,
  resolveLastMessage,
  extractLastAssistantText,
} from "./lib/implementer-verify.mjs";

try {
  // Opt-in toggle: the hooks.json command must pass `--enforce-tests`, else this hook is a no-op.
  const enabled = process.argv.includes("--enforce-tests");
  if (!enabled) process.exit(0);

  const input = await readStdinJson();
  const agentType = String(input.agent_type ?? input.subagent_type ?? "");

  // PRIMARY: the documented `last_assistant_message` field.
  let lastMessage = resolveLastMessage(input);

  // FALLBACK: only when the documented field is absent/empty, try the (undocumented for this
  // event) transcript_path — some harnesses may supply a transcript instead of the message text.
  if (!lastMessage) {
    const transcriptPath = String(input.transcript_path ?? "");
    if (transcriptPath && existsSync(transcriptPath)) {
      try {
        lastMessage = extractLastAssistantText(parseJsonl(readFileSync(transcriptPath, "utf8")));
      } catch {
        lastMessage = ""; // best-effort: an unreadable transcript reads as "no evidence found"
      }
    }
  }

  if (shouldBlockImplementerStop({ enabled, agentType, lastMessage })) {
    blockSubagentStop(
      "<ccf-implementer-verify-gate>Before stopping, add the required TEST-RESULT evidence to your " +
        "final message: run the test/verification command for this task and end with a trailing line " +
        "`TEST-RESULT: <command> → <pass/fail counts>`, or `TEST-RESULT: n/a (no test surface)` if this " +
        "task truly has no test surface (prose-only). Then finish your response again.</ccf-implementer-verify-gate>",
    );
  }
} catch {
  // Never break a subagent run — any unexpected error falls through to a clean exit.
}

process.exit(0);
