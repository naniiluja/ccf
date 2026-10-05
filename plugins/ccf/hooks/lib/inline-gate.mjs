import { withinSizeCap, noulValue, DEFAULT_CAP_BYTES } from "./completion-evidence.mjs";

export const INLINE_MAX_FILES = 3;
export const INLINE_THRESHOLD = 0.7;

const QUESTION = (id = "") =>
  `Task "${id}" in tasks[]: can it be implemented and verified as a SMALL, low-risk change (a few lines in the listed files, no new module, no cross-cutting refactor, no change to a shared contract, data format or config), so that doing it directly on the current branch instead of in an isolated git worktree is safe?`;

export function extractGoal(text = "") {
  const lines = String(text ?? "").split(/\r?\n/);
  const at = lines.findIndex((l) => /^##\s+goal\b/i.test(l));
  if (at < 0) return "";
  const next = lines.slice(at + 1).find((l) => l.trim() !== "");
  return next === undefined || /^##\s+/.test(next) ? "" : next.trim();
}

export function inlineEligibility(task = { files: [""], touchesUi: false }) {
  const t = Object(task);
  const files = Array.isArray(t.files) ? t.files.map(String).filter(Boolean) : [];
  if (t.touchesUi === true) return { eligible: false, reason: "touches-ui" };
  if (files.length === 0) return { eligible: false, reason: "no-files" };
  if (files.length > INLINE_MAX_FILES) return { eligible: false, reason: "too-many-files" };
  if (files.some((f = "") => /[{}*?]/.test(f))) return { eligible: false, reason: "unparseable-path" };
  return { eligible: true, reason: "eligible" };
}

export function buildInlineRequest(tasks = [{ id: "", title: "", goal: "", files: [""], fileLines: [0], criteria: [""], touchesUi: false }], capBytes = DEFAULT_CAP_BYTES) {
  const eligible = (Array.isArray(tasks) ? tasks : []).filter((t) => inlineEligibility(t).eligible);
  if (eligible.length === 0) return { ok: false, reason: "nothing-to-ask", state: null, questions: {} };
  const state = {
    tasks: eligible.map((t) => ({
      id: String(t.id),
      title: String(t.title ?? ""),
      goal: String(t.goal ?? ""),
      files: t.files.map((path, i) => ({ path, existingLines: Number(t.fileLines?.[i] ?? 0) })),
      criteria: Array.isArray(t.criteria) ? t.criteria.map(String) : [],
    })),
  };
  if (!withinSizeCap(JSON.stringify(state), capBytes)) return { ok: false, reason: "too-large", state: null, questions: {} };
  const questions = Object.fromEntries(state.tasks.map((t) => [`${t.id}::small`, { type: "noul", instructions: QUESTION(t.id) }]));
  return { ok: true, reason: "ok", state, questions };
}

export function decideTaskModes(tasks = [{ id: "", files: [""], touchesUi: false }], jev = { status: "not-asked", answers: {} }, threshold = INLINE_THRESHOLD) {
  const status = String(Object(jev).status ?? "not-asked");
  const answers = Object(Object(jev).answers);
  const out = new Map();
  for (const t of Array.isArray(tasks) ? tasks : []) {
    const id = String(Object(t).id ?? "");
    const eligibility = inlineEligibility(t);
    if (!eligibility.eligible) { out.set(id, { mode: "worktree", reason: eligibility.reason, score: null }); continue; }
    if (status !== "ok") { out.set(id, { mode: "worktree", reason: status, score: null }); continue; }
    const score = noulValue(answers[`${id}::small`]);
    if (score === null) out.set(id, { mode: "worktree", reason: "unanswered", score: null });
    else if (score >= threshold) out.set(id, { mode: "inline", reason: "jev-small", score });
    else out.set(id, { mode: "worktree", reason: "jev-large", score });
  }
  return out;
}
