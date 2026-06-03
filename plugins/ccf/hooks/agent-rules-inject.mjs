#!/usr/bin/env node
// CCF agent-rules-inject hook — inject the project coding rules (+ active output style's coding rules)
// into every spawned file-WRITING subagent (ccf-implementer).
// Event: SubagentStart (runs before the subagent's first prompt; cannot block subagent creation).
// Mechanism: output styles modify the MAIN system prompt only and are NOT inherited by subagents
// (grounded: code.claude.com/docs/en/output-styles + /en/sub-agents), so a spawned implementer would
// otherwise lose both the project rules and the style's coding instructions. We re-supply them via
// hookSpecificOutput.additionalContext. All decisions live in lib/output-style.mjs; this file is I/O.
// Best-effort: every fs read is defensive, ANY error → exit 0 (we MUST never block a spawn).

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, basename } from "node:path";
import { homedir } from "node:os";
import { readStdinJson, emitContext } from "./lib/io.mjs";
import {
  shouldInject,
  resolveActiveOutputStyle,
  buildInjectDirective,
} from "./lib/output-style.mjs";

const input = await readStdinJson();

// Only file-writing agents (ccf-implementer) need the directive; everyone else → no-op.
if (!shouldInject(input.agent_type)) {
  process.exit(0);
}

const cwd = String(input.cwd ?? process.cwd());

/**
 * Parse a JSON settings file, returning the object or null on any error (missing/unreadable/invalid).
 * @param {string} file path to a settings.json
 * @returns {Record<string, unknown> | null}
 */
function readSettings(file) {
  try {
    if (!existsSync(file)) return null;
    const parsed = JSON.parse(readFileSync(file, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * List a `.claude/output-styles` dir into a map of style NAME → absolute file path. The filename
 * (without .md) is the style name (the in-file `name:` override is ignored — KISS; matching the
 * common case where filename === style name). Missing/unreadable dir → {}.
 * @param {string} dir an output-styles directory
 * @returns {Record<string, string>}
 */
function listStyleFiles(dir) {
  /** @type {Record<string, string>} */
  const out = {};
  try {
    for (const entry of readdirSync(dir)) {
      if (!entry.endsWith(".md")) continue;
      out[basename(entry, ".md")] = join(dir, entry);
    }
  } catch {
    // missing dir or read error → no custom files at this level
  }
  return out;
}

try {
  // Settings layers, most-specific-first: project.local > project > user.
  const settingsLayers = [
    readSettings(join(cwd, ".claude", "settings.local.json")),
    readSettings(join(cwd, ".claude", "settings.json")),
    readSettings(join(homedir(), ".claude", "settings.json")),
  ];

  const projectStyleFiles = listStyleFiles(join(cwd, ".claude", "output-styles"));
  const userStyleFiles = listStyleFiles(join(homedir(), ".claude", "output-styles"));

  const active = resolveActiveOutputStyle({
    settingsLayers,
    projectStyleFiles,
    userStyleFiles,
  });

  emitContext("SubagentStart", buildInjectDirective(active ? active.path : null));
} catch {
  // ANY failure must not block the spawn — the directive is advisory reinforcement, not a gate.
  process.exit(0);
}
