// CCF explore-guide — pure content for the explore-guide-inject SubagentStart hook.
// Holds the language-agnostic, LSP-conditional exploration directive injected into a spawned
// Explore subagent's context. Pure (no I/O) so its content rules are unit-tested.

/**
 * Build the exploration directive injected into a spawned Explore subagent's context.
 * Language-agnostic + LSP-conditional: prefer semantic navigation when a language server exists,
 * else fall back to text search. Kept to <= ~8 non-blank lines (it is added context, not a doc).
 * @returns {string}
 */
export function buildExploreGuidance() {
  return [
    "CCF: When exploring this codebase, prefer SEMANTIC navigation over reading whole files.",
    "- If a language server is available for the file type, use the LSP tool: workspaceSymbol to",
    "  find a symbol by name, goToDefinition / goToImplementation to jump, findReferences /",
    "  incomingCalls to trace usage, documentSymbol to outline a file. (No server → the call errors;",
    "  just fall back, don't retry.)",
    "- For text/pattern search use Grep (ripgrep-backed): the `type` filter, -A/-B context, multiline.",
    "- Use Glob for filename patterns. Read whole files only after locating the relevant region.",
  ].join("\n");
}
