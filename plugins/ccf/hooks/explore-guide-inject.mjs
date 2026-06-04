#!/usr/bin/env node
// CCF explore-guide-inject hook — inject a short, language-agnostic, LSP-conditional exploration
// directive into the built-in `Explore` subagent so it prefers semantic navigation (LSP) +
// ripgrep/Grep + Glob over reading whole files.
// Event: SubagentStart (runs before the subagent's first prompt; cannot block subagent creation).
// Mechanism: CCF does not own the Explore agent's prompt (it is a harness artifact), so the only
// deterministic lever is to inject context at spawn via hookSpecificOutput.additionalContext
// (same channel as agent-rules-inject). The matcher "Explore" in hooks.json is the gate — no
// internal agent_type filter is needed; an accidental over-match only adds harmless LSP guidance.
// All content lives in lib/explore-guide.mjs; this file is I/O only.
// Best-effort: ANY error → exit 0 (we MUST never block a spawn).

import { readStdinJson, emitContext } from "./lib/io.mjs";
import { buildExploreGuidance } from "./lib/explore-guide.mjs";

try {
  await readStdinJson();
  emitContext("SubagentStart", buildExploreGuidance());
} catch {
  // The directive is advisory reinforcement, not a gate — never block the spawn on failure.
  process.exit(0);
}
