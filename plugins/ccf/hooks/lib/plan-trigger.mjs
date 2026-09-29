// CCF plan-trigger helpers — pure logic for the plan-skill-inject UserPromptSubmit hook.
// Decides whether a plan-mode prompt in a CCF-initialized project should be nudged toward the
// `ccf:plan` skill. Bare `/plan` is Claude Code's built-in, so a plugin skill cannot take that name
// (plugin skills are always `/ccf:<name>`); plan mode itself is therefore the trigger signal.
// Kept pure + defensive so it is unit-testable with `node --test` and never throws.
//
// NOTE: the transcript .jsonl format is an UNDOCUMENTED internal Claude Code shape, read best-effort
// only; on any doubt the caller treats the result as "not yet run".

import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * @typedef {object} InjectSignals
 * @property {string} mode the hook payload's permission_mode
 * @property {boolean} managed the project has a `.claude/plan` directory (CCF-initialized)
 * @property {boolean} isCcfSlash the prompt is itself a leading `/ccf:` command
 * @property {boolean} alreadyInjected the once-per-session marker already exists
 * @property {boolean} skillAlreadyRan ccf:plan already ran this session (transcript scan)
 */

/**
 * True only when a plan-mode prompt should be nudged toward `ccf:plan`. Each negative flag must be
 * the literal `false` and `managed` the literal `true`: a missing or truthy-but-wrong value reads as
 * "do not inject", because a wrong nudge costs the user a turn while a skipped nudge costs nothing
 * (the skill description is the backup).
 * @param {InjectSignals} signals
 * @returns {boolean}
 */
export function shouldInjectPlanSkill(signals) {
  const s = signals && typeof signals === "object" && !Array.isArray(signals) ? signals : null;
  if (!s) return false;
  return (
    s.mode === "plan" &&
    s.managed === true &&
    s.isCcfSlash === false &&
    s.alreadyInjected === false &&
    s.skillAlreadyRan === false
  );
}

/**
 * True when the prompt starts with a `/ccf:` command (the user already chose a CCF flow, so a nudge
 * would only duplicate it). A mid-prompt mention does not count, and neither does the built-in `/plan`.
 * @param {string} prompt
 * @returns {boolean}
 */
export function isCcfSlash(prompt) {
  return typeof prompt === "string" && /^\s*\/ccf:/i.test(prompt);
}

// Skill names that mean "the CCF plan skill was invoked". A bare "plan" is accepted because the Skill
// tool resolves unambiguous short names; over-matching only suppresses a nudge, never adds one.
const PLAN_SKILL_NAMES = new Set(["ccf:plan", "plan"]);
const PLAN_COMMAND_TAG = /<command-name>\s*\/ccf:plan\s*<\/command-name>/;

/**
 * True when the transcript shows `ccf:plan` already ran this session: an assistant `Skill` tool call
 * naming it, or a user-typed `/ccf:plan` (the harness records it as a `<command-name>` tag). Both
 * scans are role-gated so prose that merely mentions the tag never counts.
 * @param {Array<Record<string, any>>} records parsed transcript records
 * @returns {boolean}
 */
export function hasPlanSkillRun(records) {
  if (!Array.isArray(records)) return false;
  for (const r of records) {
    if (!r || typeof r !== "object") continue;
    const content = r.message?.content;
    if (r.type === "assistant" && Array.isArray(content)) {
      for (const block of content) {
        if (block?.type !== "tool_use") continue;
        if (String(block?.name ?? "").toLowerCase() !== "skill") continue;
        if (PLAN_SKILL_NAMES.has(String(block?.input?.skill ?? "").toLowerCase())) return true;
      }
    } else if (r.type === "user") {
      if (typeof content === "string") {
        if (PLAN_COMMAND_TAG.test(content)) return true;
      } else if (Array.isArray(content)) {
        for (const block of content) {
          if (block?.type === "text" && PLAN_COMMAND_TAG.test(String(block?.text ?? ""))) return true;
        }
      }
    }
  }
  return false;
}

/**
 * Per-session marker path in the OS temp dir. The session id is stripped to `[A-Za-z0-9_-]` so a
 * hostile or odd id can never escape the temp dir; an id with nothing left has no marker at all,
 * and the hook then stays silent rather than nudge on every prompt.
 * @param {string} sessionId
 * @returns {string | null}
 */
export function planInjectMarkerPath(sessionId) {
  if (typeof sessionId !== "string") return null;
  const safe = sessionId.replace(/[^A-Za-z0-9_-]/g, "");
  return safe ? join(tmpdir(), `ccf-plan-inject-${safe}`) : null;
}

/**
 * The context injected into the model. English on purpose (repo language); the skill's own style
 * block makes the reply follow the user's language.
 * @returns {string}
 */
export function buildPlanSkillDirective() {
  return (
    "<ccf>This session is in plan mode in a CCF-initialized project. Invoke the `ccf:plan` skill now " +
    "through the Skill tool, passing the user's request as the argument, before anything else. " +
    "If the request is only a question about the code, not a change to plan, answer it directly and " +
    "do not run the planning workflow.</ccf>"
  );
}
