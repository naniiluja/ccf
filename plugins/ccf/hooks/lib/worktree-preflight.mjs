// CCF worktree-preflight helpers — pure decisions behind scripts/worktree-preflight.mjs (task 066).
// Before the branches of a parallel wave are merged, check with CODE, not judgment, that nothing was
// mixed or missed: each worktree branch maps to exactly one task, its REAL changed files stay inside
// that task's declared `Files to touch` (plus tests), no two branches changed the same real file, and
// git's own merge-tree found no conflict. The declared list is a prediction written before the code
// existed (task 064, section 1), so the real diff is what this checks. Pure and defensive, never throws.

import { expandBraces, pathsClash } from "./slice-check.mjs";
import { readRuntimeEvidence } from "./runtime-evidence.mjs";

/**
 * The task id at the end of a `claude -w ccf-<iteration>-<taskid>` branch (`worktree-ccf-…`).
 * @param {any} branch
 * @returns {string | null}
 */
export function taskIdFromBranch(branch) {
  const name = String(branch ?? "").replace(/^refs\/heads\//, "");
  const m = /^worktree-ccf-[^/]*?[^-/]-([A-Za-z0-9]+)$/.exec(name);
  return m ? m[1] : null;
}

/**
 * Whether a path is a test file, in the layouts common across languages. A test for the task's own
 * files is always allowed in scope, because the CCF workflow writes the failing test first.
 * @param {any} p
 * @returns {boolean}
 */
export function isTestPath(p) {
  const path = String(p ?? "").replace(/\\/g, "/");
  return /(^|\/)(tests?|__tests__|spec)\//.test(path) ||
    /\.(test|spec)\.[\w]+$/.test(path) ||
    /_(test|spec)\.[\w]+$/.test(path) ||
    /(^|\/)test_[^/]+\.py$/.test(path);
}

/**
 * Declared entries whose braces cannot be expanded. `pathsClash` treats them as clashing with
 * everything, which is the safe direction when ordering tasks but the UNSAFE one here, where a clash
 * means "covered"; so they cover nothing and are reported instead.
 * @param {any} declared
 * @returns {string[]}
 */
export function unparseableDeclared(declared) {
  return Array.isArray(declared) ? declared.map(String).filter((d) => expandBraces(d) === null) : [];
}

/**
 * Real changed files that no parseable declared path covers and that are not tests.
 * @param {any} actual
 * @param {any} declared
 * @returns {string[]}
 */
export function outOfScope(actual, declared) {
  if (!Array.isArray(actual)) return [];
  const bad = new Set(unparseableDeclared(declared));
  const decl = (Array.isArray(declared) ? declared.map(String) : []).filter((d) => !bad.has(d));
  return actual.map(String).filter((f) => !isTestPath(f) && !decl.some((d) => pathsClash(d, f)));
}

const CRITERIA_HEADING = /^##\s+Acceptance criteria\b/i;
const ASSERTION_LINE = /(^|[^\w$])(assert\w*!?\s*[.(]|XCTAssert\w*\s*\(|Assert\.\w+\s*\(|expect\s*[.(]|should\.\w|require\.\w+\s*[.(])|(^|[^\w$.])((it|test|describe)\s*\(\s*['"`]|t\.(Error|Errorf|Fatal|Fatalf|Fail|FailNow)\s*\()|^\s*assert\s/;

export function normalizedCriteria(text = "") {
  if (typeof text !== "string") return null;
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((l) => CRITERIA_HEADING.test(l));
  if (start < 0) return null;
  const out = [];
  for (const line of lines.slice(start + 1)) {
    if (/^##\s/.test(line)) break;
    const clean = line.replace(/^\s*(?:[-*+]|\d+[.)])\s+/, "").replace(/^\[[ xX]\]\s*/, "").replace(/\s+/g, " ").trim();
    if (clean) out.push(clean);
  }
  return out;
}

export function criteriaChanged(mainText = "", branchText = "") {
  const frozen = normalizedCriteria(mainText);
  if (!frozen || typeof branchText !== "string" || branchText === "") return false;
  const now = normalizedCriteria(branchText);
  return !now || now.length !== frozen.length || now.some((c, i) => c !== frozen[i]);
}

export function assertionBalance(diffText = "") {
  const balance = { removed: 0, added: 0 };
  if (typeof diffText !== "string") return balance;
  for (const line of diffText.split(/\r?\n/)) {
    if (line.startsWith("---") || line.startsWith("+++")) continue;
    const sign = line[0];
    if ((sign === "-" || sign === "+") && ASSERTION_LINE.test(line.slice(1))) balance[sign === "-" ? "removed" : "added"]++;
  }
  return balance;
}

/**
 * @typedef {{ branch: string, id: string | null, taskFile: string | null, declared: string[], actual: string[], mergeClean: boolean | null }} PreflightBranch
 * @typedef {{ kind: string, branch?: string, id?: string | null, with?: string, files?: string[] }} PreflightProblem
 */

/**
 * Every blocking problem of a wave. `mergeClean` / pair `clean`: true = merge-tree exit 0, false = a
 * conflict, null = git failed (which blocks too: an unverified merge is not a clean one).
 * @param {any} input `{ gitOk, branches: PreflightBranch[], pairs: { a, b, clean }[] }`
 * @returns {{ ready: boolean, problems: PreflightProblem[] }}
 */
export function assessPreflight(input) {
  /** @type {PreflightProblem[]} */
  const problems = [];
  /** @type {any[]} */
  const branches = (Array.isArray(input?.branches) ? input.branches : []).filter((/** @type {any} */ b) => b && typeof b === "object");
  /** @type {any[]} */
  const pairs = Array.isArray(input?.pairs) ? input.pairs.filter((/** @type {any} */ p) => p && typeof p === "object") : [];
  if (input?.gitOk !== true) problems.push({ kind: "git-too-old" });
  if (branches.length === 0) problems.push({ kind: "no-branches" });

  /** @type {Map<string, string>} */
  const seen = new Map();
  for (const b of branches) {
    const branch = String(b.branch ?? "");
    const id = b.id == null ? null : String(b.id);
    const declared = Array.isArray(b.declared) ? b.declared.map(String) : [];
    if (!id || !b.taskFile) {
      problems.push({ kind: "unmatched-branch", branch, id });
      continue;
    }
    if (seen.has(id)) problems.push({ kind: "duplicate-task", branch, id, with: seen.get(id) });
    else seen.set(id, branch);
    const unparseable = unparseableDeclared(declared);
    if (unparseable.length) problems.push({ kind: "unparseable-declared", branch, id, files: unparseable });
    if (declared.length === 0) problems.push({ kind: "no-declared-files", branch, id });
    else {
      const extra = outOfScope(b.actual, [...declared, `.claude/plan/${b.taskFile}`]);
      if (extra.length) problems.push({ kind: "out-of-scope", branch, id, files: extra });
    }
    if (readRuntimeEvidence(b.taskText, b.uiText).state === "empty") problems.push({ kind: "missing-runtime-evidence", branch, id });
    const touchedTaskFile = Array.isArray(b.actual) && b.actual.map(String).includes(`.claude/plan/${b.taskFile}`);
    const taskFileGone = b.taskGone === true && normalizedCriteria(b.uiText) !== null;
    if ((touchedTaskFile && criteriaChanged(b.uiText, b.taskText)) || taskFileGone) problems.push({ kind: "criteria-changed", branch, id });
    const { removed, added } = assertionBalance(b.testDiff);
    const weakened = { kind: "existing-test-weakened", branch, id, removed, added };
    if (removed > added) problems.push(weakened);
    if (b.mergeClean === false) problems.push({ kind: "merge-conflict", branch, id });
    else if (b.mergeClean !== true) problems.push({ kind: "git-error", branch, id });
  }

  for (let i = 0; i < branches.length; i++) {
    for (let j = i + 1; j < branches.length; j++) {
      /** @type {string[]} */
      const a = Array.isArray(branches[i].actual) ? branches[i].actual.map(String) : [];
      const setB = new Set(Array.isArray(branches[j].actual) ? branches[j].actual.map(String) : []);
      const shared = a.filter((f) => setB.has(f));
      if (shared.length) problems.push({ kind: "actual-overlap", branch: String(branches[i].branch), with: String(branches[j].branch), files: shared });
    }
  }
  for (const p of pairs) {
    if (p.clean === false) problems.push({ kind: "pair-conflict", branch: String(p.a), with: String(p.b) });
    else if (p.clean !== true) problems.push({ kind: "git-error", branch: String(p.a), with: String(p.b) });
  }
  return { ready: problems.length === 0, problems };
}
