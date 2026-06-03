// CCF output-style decision lib — pure helpers for the agent-rules-inject SubagentStart hook.
// Output styles modify the MAIN system prompt only and are NOT inherited by subagents
// (grounded: code.claude.com/docs/en/output-styles + /en/sub-agents), so a spawned writer agent
// loses both the project coding rules and the active style's coding instructions. These pure
// functions decide WHICH agent gets injected, WHICH style is active, and WHAT directive to inject.
// The hook does the I/O; all branching decisions live here so they are node --test covered.

/**
 * File-writing agents that must receive the coding-rules directive. Only ccf-implementer writes
 * code; read-only research/review agents (ccf-codebase-analyzer, ccf-spec-checker, …) do not.
 * @type {Set<string>}
 */
export const WRITER_AGENTS = new Set(["ccf-implementer"]);

/**
 * Whether a spawning agent should receive the injected coding-rules directive.
 * @param {string | undefined} agentType the SubagentStart input.agent_type
 * @returns {boolean}
 */
export function shouldInject(agentType) {
  return WRITER_AGENTS.has(String(agentType ?? ""));
}

/**
 * Resolve the currently-active output style from the settings layers + the discovered style files.
 * Precedence is by layer ORDER (caller passes most-specific-first: project.local > project > user);
 * within the chosen style name, a PROJECT file wins over a same-name USER file. A built-in style
 * (Explanatory/Learning) has no file → { name, path: null }. No `outputStyle` key, blank value,
 * non-string value, or malformed layer → null.
 * @param {{
 *   settingsLayers: unknown[],
 *   projectStyleFiles: Record<string, string>,
 *   userStyleFiles: Record<string, string>,
 * }} args
 *   settingsLayers ordered most-specific-first; each is a parsed settings object (or junk → skipped).
 *   projectStyleFiles / userStyleFiles map a custom style NAME to its absolute file PATH.
 * @returns {{ name: string, path: string | null } | null}
 */
export function resolveActiveOutputStyle(args) {
  const { settingsLayers, projectStyleFiles, userStyleFiles } = args;
  if (!Array.isArray(settingsLayers)) return null;

  let name = "";
  for (const layer of settingsLayers) {
    if (!layer || typeof layer !== "object") continue; // skip null / string / number / undefined layers
    const value = /** @type {Record<string, unknown>} */ (layer).outputStyle;
    if (typeof value !== "string") continue; // ignore non-string outputStyle values
    const trimmed = value.trim();
    if (!trimmed) continue; // blank → fall through to the next (less specific) layer
    name = trimmed;
    break;
  }
  if (!name) return null;

  const proj = projectStyleFiles ?? {};
  const user = userStyleFiles ?? {};
  const path =
    typeof proj[name] === "string"
      ? proj[name]
      : typeof user[name] === "string"
        ? user[name]
        : null;
  return { name, path };
}

/**
 * Build the directive injected into a writer subagent's context at start. Always orders the agent to
 * read & obey the project coding rules (.claude/rules/*). When a custom style file is resolved, also
 * orders it to read that file for CODING rules ONLY, explicitly EXCLUDING persona/tone/narration/
 * emoji/roleplay (those modify communication, not code, and must not leak into produced code), then
 * to self-check the result against both. Kept short (≤ ~6 non-empty lines) — it is context tokens.
 * @param {string | null} stylePath absolute path to the active custom style file, or null (built-in/none)
 * @returns {string}
 */
export function buildInjectDirective(stylePath) {
  const lines = [
    "CCF: Before writing any code, read and obey the project coding rules in .claude/rules/* (and CLAUDE.md).",
  ];
  if (stylePath) {
    lines.push(
      `Also read the active output style at ${stylePath} and apply ONLY its CODING rules (e.g. comment/format/structure conventions).`,
    );
    lines.push(
      "EXCLUDE its persona, tone, narration, emoji and roleplay — those shape communication, not code, and must NOT appear in produced code or commits.",
    );
  }
  lines.push(
    "Before finishing, self-check the code against these rules and fix any violation.",
  );
  return lines.join("\n");
}
