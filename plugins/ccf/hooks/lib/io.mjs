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
 * Inject context for Claude via additionalContext (supported at SessionStart, PreToolUse,
 * PostToolUse, Stop...). Print JSON to stdout then exit 0.
 * @param {string} eventName the hook event name (e.g. "SessionStart", "Stop")
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
 * Block a prompt at UserPromptSubmit: write the reason to stderr (shown to Claude/the user) then exit 2.
 * Exit code 2 = blocking error per the hook contract.
 * @param {string} reason the reason for blocking
 */
export function blockUserPrompt(reason) {
  process.stderr.write(reason);
  process.exit(2);
}
