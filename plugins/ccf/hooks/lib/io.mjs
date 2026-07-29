// CCF hook I/O helpers — run directly with `node`, no build step, no dependency.
// Claude Code hook contract: receive JSON on stdin, return JSON on stdout / use exit codes.

/**
 * Shared clause reused by every advisory hook that tells the model to relay a message to the user
 * (context-guard.mjs, updatespec-nudge.mjs): a hook can never know what language the user is typing
 * in, so the model must be told to relay IN THE USER'S OWN LANGUAGE rather than a hardcoded-English
 * string handed straight to the user. Factored here (task cc-2.1.220-realign) because it had been
 * copy-typed four times across two files, drifting slightly each time. Lives in io.mjs, the shared
 * infrastructure layer every hook already imports, rather than in either hook file.
 * @type {string}
 */
export const RELAY_IN_USER_LANGUAGE = "IN THE LANGUAGE THEY ARE USING";

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
        const parsed = JSON.parse(text);
        // JSON.parse accepts any valid JSON value, not just objects — the literal "null", "42",
        // "\"x\"" or "[]" all parse successfully but are not objects a hook can safely do
        // `input.someField` on. Every CCF hook expects an object; fall back to {} for anything else
        // so a non-object payload can never crash a hook with a TypeError.
        resolve(parsed !== null && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {});
      } catch {
        resolve({});
      }
    });
    process.stdin.on("error", () => resolve({}));
  });
}

/**
 * Inject context for Claude via additionalContext. Valid for events whose schema accepts
 * hookSpecificOutput.additionalContext (SessionStart, UserPromptSubmit, PostToolUse,
 * SubagentStart — the latter adds the string to the subagent's context before its first
 * prompt — and, per the Claude Code 2.1.163 changelog, Stop and SubagentStop as well; NOT YET
 * OBSERVED live on this project's harness, see project memory `subagentstop-shape-unconfirmed`).
 * PreToolUse exposes only permissionDecision via this helper's sibling `denyTool` (see below). The
 * body is event-agnostic; pass the matching event name. Print JSON to stdout then exit 0.
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
 * Surface an advisory message from a Stop hook WITHOUT blocking the stop. Omitting `decision`
 * lets the stop proceed normally while `systemMessage` shows the nudge.
 * This is ADVISORY only — to BLOCK a stop and drive the main loop, use `blockStop` instead.
 * @param {string} text the advisory message to surface
 */
export function emitSystemMessage(text) {
  process.stdout.write(JSON.stringify({ systemMessage: text }));
  process.exit(0);
}

/**
 * BLOCK a Stop and drive the main loop (the "ralph loop"): `decision: "block"` forces Claude to keep
 * working, and `reason` is fed back as the next instruction. `systemMessage` shows the user a short
 * note about why the stop was blocked. Then exit 0 (the block is carried by the JSON, NOT an exit code
 * — Stop is the inverse of UserPromptSubmit, where exit 2 blocks). The opposite of `emitSystemMessage`,
 * which is advisory and lets the stop proceed.
 * @param {string} reason the instruction fed back to the main loop (drives the next turn)
 * @param {string} systemMessage a short user-facing note about the block
 */
export function blockStop(reason, systemMessage) {
  process.stdout.write(JSON.stringify({ decision: "block", reason, systemMessage }));
  process.exit(0);
}

/**
 * BLOCK a SubagentStop: `decision: "block"` keeps the SUBAGENT running (scope is child-only — it does
 * NOT affect the main loop) and `reason` is fed back as the subagent's next instruction. Unlike
 * `blockStop` (the main-loop Stop event), this does NOT blindly reuse `blockStop`'s shape — it emits
 * only `decision`/`reason`, by design: per changelog/docs at authoring time (task 034), SubagentStop
 * may ALSO accept `additionalContext`, but whether a BLOCKED SubagentStop's `additionalContext` still
 * reaches the subagent for that turn is UNCONFIRMED, NOT YET OBSERVED on a real harness payload (see
 * project memory `subagentstop-shape-unconfirmed`) — so this helper deliberately stays narrow
 * (`decision`/`reason` only) rather than assume an unverified field behaves a particular way.
 * Then exit 0 (the block is carried by the JSON, not the exit code).
 * @param {string} reason the instruction fed back to the subagent (drives its next turn)
 */
export function blockSubagentStop(reason) {
  process.stdout.write(JSON.stringify({ decision: "block", reason }));
  process.exit(0);
}

/**
 * Build the combined `{ hookSpecificOutput: { hookEventName, additionalContext }, systemMessage }`
 * payload shared by `emitPromptWarning` (UserPromptSubmit) and `emitStopAdvisory` (Stop) — both
 * reach the model via `additionalContext` AND the user via `systemMessage` in one non-blocking emit.
 * Module-private: not exported. NOTE (task cc-2.1.220-realign, correcting a stale claim): `emitContext`
 * ALSO builds the same inner `{ hookSpecificOutput: { hookEventName, additionalContext } }` shape —
 * it is not one of some independent set of "other" shapes, it genuinely overlaps this helper. Folding
 * it in was deliberately NOT done here: a code-review pass scoped this cleanup to leave `emitContext`
 * untouched, so that fold is intentionally deferred, not an oversight.
 * @param {string} eventName the hook event name (e.g. "UserPromptSubmit", "Stop")
 * @param {string} context the model-facing context to inject
 * @param {string} message the user-facing message to display
 * @returns {string} the JSON-stringified payload
 */
function buildDualChannelPayload(eventName, context, message) {
  return JSON.stringify({
    hookSpecificOutput: {
      hookEventName: eventName,
      additionalContext: context,
    },
    systemMessage: message,
  });
}

/**
 * Surface a non-blocking warning at UserPromptSubmit through BOTH channels: `additionalContext`
 * (model-facing, enters Claude's context) and `systemMessage` (the universal user-facing field).
 * Lets the prompt proceed (exit 0) while the user actually SEES the message. Print JSON then exit 0.
 * @param {string} context the model-facing context to inject
 * @param {string} message the user-facing warning to display
 */
export function emitPromptWarning(context, message) {
  process.stdout.write(buildDualChannelPayload("UserPromptSubmit", context, message));
  process.exit(0);
}

/**
 * Surface a non-blocking advisory at Stop through BOTH channels: `additionalContext` (model-facing,
 * per the Claude Code 2.1.163 changelog's Stop additionalContext support — NOT YET OBSERVED live on
 * this project's harness) and `systemMessage` (user-facing). Lets
 * the stop proceed (exit 0) — this is the DUAL-CHANNEL sibling of `emitSystemMessage`, which reaches
 * only the user. Opt-in only: callers must gate this behind an explicit toggle (e.g.
 * `--dual-channel-stop`) since the default Stop advisory path must stay single-channel.
 * @param {string} context the model-facing context to inject
 * @param {string} message the user-facing advisory to display
 */
export function emitStopAdvisory(context, message) {
  process.stdout.write(buildDualChannelPayload("Stop", context, message));
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
