import { taskIdFromBranch } from "./worktree-preflight.mjs";

export const WORKTREE_NAME_MAX = 64;
const FALLBACK_SLUG = "iter";

export function iterationSlug(planText = "") {
  const text = typeof planText === "string" ? planText : "";
  const heading = /^##\s+Origin\b[\s:—–-]*(.*)$/im.exec(text);
  const slug = String(heading?.[1] ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 24)
    .replace(/[-.]+$/, "");
  return slug || FALLBACK_SLUG;
}

export function worktreeName(slug = "", id = "") {
  const taskId = String(id ?? "");
  if (!/^[A-Za-z0-9]+$/.test(taskId)) return null;
  const room = WORKTREE_NAME_MAX - "ccf-".length - 1 - taskId.length;
  if (room < 1) return null;
  const cut = String(slug ?? "").slice(0, room).replace(/[^A-Za-z0-9._-]/g, "-").replace(/[-.]+$/, "") || FALLBACK_SLUG.slice(0, room);
  const name = `ccf-${cut}-${taskId}`;
  return taskIdFromBranch(`worktree-${name}`) === taskId ? name : null;
}

export function worktreesByBranch(porcelain = "") {
  const out = new Map();
  let path = "";
  for (const line of String(porcelain ?? "").split(/\r?\n/)) {
    if (line.startsWith("worktree ")) path = line.slice("worktree ".length);
    else if (line.startsWith("branch refs/heads/") && path) out.set(line.slice("branch refs/heads/".length), path);
    else if (line === "") path = "";
  }
  return out;
}

export function applyBlockers(input = {}) {
  const { preflight, cleanTree, testCommand, apply } = Object(input);
  const blockers = [];
  if (!preflight || preflight.ok !== true) blockers.push("preflight-failed");
  else if (preflight.ready !== true) blockers.push("preflight-not-ready");
  if (apply === true) {
    if (cleanTree !== true) blockers.push("dirty-tree");
    if (!String(testCommand ?? "").trim()) blockers.push("no-test-command");
  }
  return blockers;
}

export function tail(text = "", max = 4000) {
  const s = String(text ?? "");
  return s.length > max ? s.slice(s.length - max) : s;
}
