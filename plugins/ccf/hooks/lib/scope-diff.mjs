import { extractFiles } from "./slice-check.mjs";
import { outOfScope, unparseableDeclared } from "./worktree-preflight.mjs";

const INLINE_SCOPE = /^\s*(?:[-*]\s+)?\**files to touch\**\s*:\**\s*(.+)$/i;

const normalize = (path = "") => String(path).replace(/\\/g, "/").replace(/^\.\//, "");

export function declaredScope(taskText = "") {
  if (typeof taskText !== "string") return [];
  const fromSection = extractFiles(taskText);
  if (fromSection.length > 0) return fromSection;
  const inline = taskText
    .split(/\r?\n/)
    .filter((line) => !/^\s*[-*]\s+\[[ xX]\]/.test(line))
    .map((line) => INLINE_SCOPE.exec(line))
    .find(Boolean);
  return inline ? extractFiles(`## Files to touch\n${inline[1]}`) : [];
}

const isBookkeeping = (file = "", taskFile = "") =>
  file === ".claude/plan/PLAN.md" || (taskFile !== "" && file === normalize(taskFile));

export function assessScope({ changed = [""], taskText = "", taskFile = "" } = {}) {
  const declared = declaredScope(taskText);
  const files = (Array.isArray(changed) ? changed : [])
    .map(normalize)
    .filter((file) => file !== "" && !isBookkeeping(file, String(taskFile ?? "")));
  return {
    declared,
    unparseable: unparseableDeclared(declared),
    noDeclaredFiles: declared.length === 0,
    outOfScope: declared.length === 0 ? [] : outOfScope(files, declared),
  };
}
