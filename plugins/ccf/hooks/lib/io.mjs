// CCF hook I/O helpers — run directly with `node`, no build step, no dependency.
// Claude Code hook contract: receive JSON on stdin, return JSON on stdout / use exit codes.

/**
 * Read all of stdin and parse JSON. If empty or on error → return {} so the hook never crashes.
 * @returns {Promise<Record<string, any>>}
 */
export async function readStdinJson() {
  return new Promise((resolve) => {
    let raw = "";
    // If there is no stdin (run manually without a pipe), avoid hanging: resolve {} when the stream closes.
    if (process.stdin.isTTY) {
      resolve({});
      return;
    }
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      raw += chunk;
    });
    process.stdin.on("end", () => {
      const text = raw.trim();
      if (!text) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(text));
      } catch {
        resolve({});
      }
    });
    process.stdin.on("error", () => resolve({}));
  });
}

/**
 * Inject context for Claude via additionalContext. Valid ONLY for events whose schema
 * accepts hookSpecificOutput.additionalContext (SessionStart, UserPromptSubmit, PostToolUse).
 * PreToolUse (permissionDecision only) and Stop do NOT — for a non-blocking Stop advisory
 * use emitSystemMessage instead.
 * Print JSON to stdout then exit 0.
 * @param {string} eventName the hook event name (e.g. "SessionStart", "PostToolUse")
 * @param {string} text the context to inject
 */
export function emitContext(eventName, text) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: eventName,
        additionalContext: text,
      },
    }),
  );
  process.exit(0);
}

/**
 * Surface an advisory message from a Stop hook WITHOUT blocking the stop. A Stop hook's
 * only output fields are decision/reason/systemMessage; it has NO additionalContext.
 * Omitting `decision` lets the stop proceed normally while `systemMessage` shows the nudge.
 * @param {string} text the advisory message to surface
 */
export function emitSystemMessage(text) {
  process.stdout.write(JSON.stringify({ systemMessage: text }));
  process.exit(0);
}

/**
 * Block a prompt at UserPromptSubmit: write the reason to stderr (shown to Claude/the user) then exit 2.
 * Exit code 2 = blocking error per the hook contract.
 * @param {string} reason the reason for blocking
 */
export function blockUserPrompt(reason) {
  process.stderr.write(reason);
  process.exit(2);
}

/**
 * Deny a tool call at PreToolUse. Unlike UserPromptSubmit (exit 2), PreToolUse blocks via a JSON
 * permissionDecision — exit 0 with `permissionDecision: "deny"`; the reason is shown to Claude.
 * @param {string} reason why the tool call is denied (guidance for Claude)
 */
export function denyTool(reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: reason,
      },
    }),
  );
  process.exit(0);
}
