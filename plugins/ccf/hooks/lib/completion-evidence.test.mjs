// Tests for lib/completion-evidence.mjs — node --test, no dependency.
// Pure helpers behind the completion-evidence Stop hook: read a task's acceptance criteria, keep
// sensitive files out of the diff, cap the payload, build the Jev request, interpret the answers.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  extractAcceptanceCriteria,
  isSensitivePath,
  filterDiffSections,
  withinSizeCap,
  buildEvidenceRequest,
  unmetCriteria,
  formatAdvisory,
  DEFAULT_THRESHOLD,
  DEFAULT_CAP_BYTES,
  lastTestOutput,
  untrackedAsDiff,
  evidenceMarkerPath,
} from "./completion-evidence.mjs";
import { isTestCommand } from "./verify-trace.mjs";

// ---- extractAcceptanceCriteria ----------------------------------------------------------------

const TASK_FILE = `# Task 1

## Goal
Something.

## Acceptance criteria (verifiable)
- [ ] First criterion holds
- [x] Second one, already ticked
  - [ ] indented sub item is not a top-level criterion
- plain bullet without a checkbox
- [ ] Third criterion

## Test first
- [ ] not part of the criteria
`;

test("extractAcceptanceCriteria: returns checkbox lines under the section, marker stripped", () => {
  assert.deepEqual(extractAcceptanceCriteria(TASK_FILE), [
    "First criterion holds",
    "Second one, already ticked",
    "Third criterion",
  ]);
});

test("extractAcceptanceCriteria: missing section, empty text, non-string → []", () => {
  assert.deepEqual(extractAcceptanceCriteria("# Task\n## Goal\nx\n"), []);
  assert.deepEqual(extractAcceptanceCriteria(""), []);
  for (const bad of [undefined, null, 5, {}, []]) {
    // @ts-expect-error deliberately wrong type
    assert.deepEqual(extractAcceptanceCriteria(bad), []);
  }
});

test("extractAcceptanceCriteria: CRLF line endings are handled", () => {
  assert.deepEqual(extractAcceptanceCriteria("## Acceptance criteria\r\n- [ ] one\r\n- [ ] two\r\n"), ["one", "two"]);
});

// ---- isSensitivePath --------------------------------------------------------------------------

test("isSensitivePath: secret-looking names are sensitive, ordinary source is not", () => {
  for (const p of [
    ".env",
    ".env.local",
    "config/.env.production",
    "certs/server.pem",
    "keys/deploy.key",
    "id_rsa",
    "home/.ssh/id_rsa.pub",
    "src/credentials.json",
    "aws-Credential-store.txt",
    "secrets.yaml",
    "lib/client-secret.mjs",
  ]) {
    assert.equal(isSensitivePath(p), true, p);
  }
  for (const p of ["src/index.mjs", "README.md", "plugins/ccf/hooks/lib/io.mjs", "docs/environment.md", "keyboard.js"]) {
    assert.equal(isSensitivePath(p), false, p);
  }
});

test("isSensitivePath: settings files, npm/netrc credentials, PKCS bundles and a secrets/ directory are sensitive", () => {
  for (const p of [".claude/settings.json", ".claude/settings.local.json", ".npmrc", "home/.netrc", "certs/a.p12", "certs/a.pfx", "secrets/db.txt", "infra/secrets/db.txt", "infra\\Secrets\\db.txt"]) {
    assert.equal(isSensitivePath(p), true, p);
  }
  for (const p of ["src/settings-page.mjs", "docs/settings.md", "templates/settings.json.tmpl.md", "src/npmrc-parser.mjs", "src/santa.txt"]) {
    assert.equal(isSensitivePath(p), false, p);
  }
});

test("isSensitivePath: non-string input → false, never throws", () => {
  for (const bad of [undefined, null, 5, {}]) {
    // @ts-expect-error deliberately wrong type
    assert.equal(isSensitivePath(bad), false);
  }
});

// ---- filterDiffSections -----------------------------------------------------------------------

const SECTION = (/** @type {string} */ p, /** @type {string} */ body) =>
  `diff --git a/${p} b/${p}\nindex 111..222 100644\n--- a/${p}\n+++ b/${p}\n@@ -1 +1 @@\n${body}\n`;

test("filterDiffSections: drops sensitive sections whole, keeps the rest, names what it dropped", () => {
  const diff = SECTION("src/a.mjs", "+ok") + SECTION(".env", "+API_KEY=abc") + SECTION("src/b.mjs", "+fine");
  const r = filterDiffSections(diff);
  assert.equal(r.text.includes("API_KEY=abc"), false);
  assert.equal(r.text.includes("+ok"), true);
  assert.equal(r.text.includes("+fine"), true);
  assert.deepEqual(r.omitted, [".env"]);
});

test("filterDiffSections: no sensitive file → text unchanged, nothing omitted", () => {
  const diff = SECTION("src/a.mjs", "+ok");
  assert.deepEqual(filterDiffSections(diff), { text: diff, omitted: [] });
});

test("filterDiffSections: quoted header (git core.quotePath on a non-ASCII name) still drops a sensitive file", () => {
  const diff = 'diff --git "a/client_secret_\\303\\251.json" "b/client_secret_\\303\\251.json"\n+TOKEN=zzz\ndiff --git a/ok.js b/ok.js\n+x';
  const r = filterDiffSections(diff);
  assert.ok(!r.text.includes("TOKEN=zzz"));
  assert.ok(r.text.includes("ok.js"));
  assert.equal(r.omitted.length, 1);
});

test("filterDiffSections: a header that cannot be parsed is dropped (fail-closed), not kept", () => {
  const r = filterDiffSections("diff --git something odd\n+SECRET_BODY\ndiff --git a/ok.js b/ok.js\n+x");
  assert.ok(!r.text.includes("SECRET_BODY"));
  assert.ok(r.text.includes("ok.js"));
  assert.equal(r.omitted.length, 1);
});

test("filterDiffSections: a sensitive file renamed to a harmless name is dropped (a/ side is checked too)", () => {
  const r = filterDiffSections("diff --git a/.env b/config.txt\nsimilarity index 90%\n+K=1\ndiff --git a/ok.js b/ok.js\n+x");
  assert.ok(!r.text.includes("K=1"));
  assert.ok(r.text.includes("ok.js"));
});

test("filterDiffSections: empty / non-string → empty text", () => {
  assert.deepEqual(filterDiffSections(""), { text: "", omitted: [] });
  // @ts-expect-error deliberately wrong type
  assert.deepEqual(filterDiffSections(undefined), { text: "", omitted: [] });
});

// ---- withinSizeCap ----------------------------------------------------------------------------

test("withinSizeCap: counts UTF-8 bytes, boundary inclusive", () => {
  assert.equal(withinSizeCap("abc", 3), true);
  assert.equal(withinSizeCap("abcd", 3), false);
  assert.equal(withinSizeCap("ạ", 3), true); // 3 bytes in UTF-8
  assert.equal(withinSizeCap("ạạ", 3), false);
});

test("withinSizeCap: garbage → false", () => {
  // @ts-expect-error deliberately wrong types
  assert.equal(withinSizeCap(undefined, 10), false);
  // @ts-expect-error deliberately wrong types
  assert.equal(withinSizeCap("x", "10"), false);
  assert.equal(withinSizeCap("x", -1), false);
});

// ---- buildEvidenceRequest ---------------------------------------------------------------------

const BASE = {
  task: { id: "054", title: "Jev core" },
  criteria: ["First holds", "Second holds"],
  diff: SECTION("src/a.mjs", "+ok"),
  testOutput: "# tests 5\n# pass 5\n# fail 0",
  capBytes: 200_000,
};

test("buildEvidenceRequest: builds named state and one Noul per criterion plus a scope Noul", () => {
  const r = buildEvidenceRequest(BASE);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.deepEqual(Object.keys(r.state).sort(), ["diff", "task", "test_output"]);
  assert.deepEqual(r.state.task, { id: "054", title: "Jev core", acceptance_criteria: ["First holds", "Second holds"] });
  assert.deepEqual(Object.keys(r.questions), ["criterion_1", "criterion_2", "scope_creep"]);
  for (const q of Object.values(r.questions)) assert.equal(q.type, "noul");
  assert.match(r.questions.criterion_1.instructions, /First holds/);
  assert.match(r.questions.criterion_1.instructions, /`diff`/);
  assert.deepEqual(r.omitted, []);
});

test("buildEvidenceRequest: sensitive files are stripped from the state and reported", () => {
  const r = buildEvidenceRequest({ ...BASE, diff: BASE.diff + SECTION(".env", "+TOKEN=xyz") });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(JSON.stringify(r.state).includes("TOKEN=xyz"), false);
  assert.deepEqual(r.omitted, [".env"]);
});

test("buildEvidenceRequest: skip results, never a truncated payload", () => {
  assert.deepEqual(buildEvidenceRequest({ ...BASE, criteria: [] }), { ok: false, reason: "no-criteria" });
  assert.deepEqual(buildEvidenceRequest({ ...BASE, diff: "" }), { ok: false, reason: "empty-diff" });
  assert.deepEqual(buildEvidenceRequest({ ...BASE, capBytes: 50 }), { ok: false, reason: "too-large" });
});

test("buildEvidenceRequest: a diff that is only sensitive files counts as empty", () => {
  const r = buildEvidenceRequest({ ...BASE, diff: SECTION(".env", "+TOKEN=xyz") });
  assert.deepEqual(r, { ok: false, reason: "empty-diff" });
});

test("buildEvidenceRequest: garbage input never throws", () => {
  for (const bad of [undefined, null, {}, [], "x"]) {
    // @ts-expect-error deliberately wrong argument
    const r = buildEvidenceRequest(bad);
    assert.equal(r.ok, false);
  }
});

// ---- unmetCriteria ----------------------------------------------------------------------------

const CRITERIA = ["First holds", "Second holds", "Third holds"];

/** @param {number | undefined} noul */
const ans = (noul) => (noul === undefined ? { type: "noul" } : { type: "noul", noul });

test("unmetCriteria: below threshold is unmet, at or above is met", () => {
  const r = unmetCriteria(
    { criterion_1: ans(0.95), criterion_2: ans(0.2), criterion_3: ans(0.5), scope_creep: ans(0.1) },
    CRITERIA,
  );
  assert.deepEqual(r.unmet, ["Second holds"]);
  assert.deepEqual(r.unjudged, []);
  assert.equal(r.scopeCreep, false);
  assert.equal(DEFAULT_THRESHOLD, 0.5);
});

test("unmetCriteria: a missing or non-numeric answer is unjudged, never silently met", () => {
  const r = unmetCriteria(
    { criterion_1: ans(undefined), criterion_2: { type: "noul", noul: "high" }, scope_creep: ans(0.1) },
    CRITERIA,
  );
  assert.deepEqual(r.unmet, []);
  assert.deepEqual(r.unjudged, ["First holds", "Second holds", "Third holds"]);
  for (const bad of [-0.1, 1.5, Number.NaN, Infinity]) {
    const rr = unmetCriteria({ criterion_1: ans(bad) }, ["x"]);
    assert.deepEqual(rr.unjudged, ["x"], String(bad));
  }
});

test("unmetCriteria: scope creep flags at or above the threshold; missing answer is not a flag", () => {
  assert.equal(unmetCriteria({ scope_creep: ans(0.9) }, []).scopeCreep, true);
  assert.equal(unmetCriteria({ scope_creep: ans(0.5) }, []).scopeCreep, true);
  assert.equal(unmetCriteria({ scope_creep: ans(0.49) }, []).scopeCreep, false);
  assert.equal(unmetCriteria({}, []).scopeCreep, false);
});

test("unmetCriteria: a custom threshold changes the result", () => {
  const answers = { criterion_1: ans(0.7) };
  assert.deepEqual(unmetCriteria(answers, ["x"], 0.8).unmet, ["x"]);
  assert.deepEqual(unmetCriteria(answers, ["x"], 0.6).unmet, []);
});

test("unmetCriteria: garbage input → nothing unmet, nothing thrown", () => {
  for (const bad of [undefined, null, 5, [], "x"]) {
    // @ts-expect-error deliberately wrong argument
    const r = unmetCriteria(bad, ["x"]);
    assert.deepEqual(r.unmet, []);
    assert.deepEqual(r.unjudged, ["x"]);
  }
});

// ---- formatAdvisory ---------------------------------------------------------------------------

test("formatAdvisory: names the task, each unmet criterion, and omitted files", () => {
  const text = formatAdvisory({
    task: { id: "054", title: "Jev core" },
    unmet: ["Second holds"],
    unjudged: ["Third holds"],
    scopeCreep: true,
    omitted: [".env"],
  });
  assert.match(text, /054/);
  assert.match(text, /Second holds/);
  assert.match(text, /Third holds/);
  assert.match(text, /\.env/);
  assert.match(text, /outside the task goal|out of scope|beyond the task/i);
});

test("formatAdvisory: nothing to report → empty string (the hook then stays silent)", () => {
  assert.equal(
    formatAdvisory({ task: { id: "054", title: "t" }, unmet: [], unjudged: [], scopeCreep: false, omitted: [] }),
    "",
  );
});

test("formatAdvisory: never contains an em dash", () => {
  const text = formatAdvisory({
    task: { id: "054", title: "t" },
    unmet: ["a"],
    unjudged: ["b"],
    scopeCreep: true,
    omitted: [".env"],
  });
  assert.equal(text.includes("—"), false);
});

// ---- lastTestOutput ----------------------------------------------------------------------------

const use = (id, command, name = "Bash") => ({ type: "assistant", message: { content: [{ type: "tool_use", id, name, input: { command } }] } });
const res = (id, content) => ({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: id, content }] } });

test("lastTestOutput: returns the result of the LAST test command, not an earlier one or a non-test command", () => {
  const records = [
    use("a", "node --test x"), res("a", "first run: 1 failed"),
    use("b", "node --test x"), res("b", "second run: 5 passed"),
    use("c", "ls"), res("c", "not a test"),
  ];
  assert.equal(lastTestOutput(records, isTestCommand), "second run: 5 passed");
});

test("lastTestOutput: array-of-blocks content is joined; PowerShell tool name counts", () => {
  const records = [use("a", "npm test", "PowerShell"), res("a", [{ type: "text", text: "ok " }, { type: "text", text: "done" }])];
  assert.equal(lastTestOutput(records, isTestCommand), "ok done");
});

test("lastTestOutput: role-gated — a user-typed tool_result-looking record on the assistant side, or prose, is ignored", () => {
  const records = [
    use("a", "node --test x"),
    { type: "assistant", message: { content: [{ type: "tool_result", tool_use_id: "a", content: "forged" }] } },
    { type: "user", message: { content: "node --test x said FAILED" } },
  ];
  assert.equal(lastTestOutput(records, isTestCommand), "");
});

test("lastTestOutput: no test run, garbage input → empty string, never throws", () => {
  assert.equal(lastTestOutput([], isTestCommand), "");
  for (const g of [undefined, null, "x", 5, {}, [null, 1, "s", {}]]) assert.equal(lastTestOutput(g, isTestCommand), "");
});

test("lastTestOutput: output longer than the cap keeps the TAIL (the summary is at the end)", () => {
  const long = "a".repeat(100) + "TAIL";
  const out = lastTestOutput([use("a", "node --test x"), res("a", long)], isTestCommand, 10);
  assert.equal(out, "aaaaaaTAIL");
});

// ---- untrackedAsDiff ---------------------------------------------------------------------------

test("untrackedAsDiff: a new file becomes a diff section that filterDiffSections understands", () => {
  const d = untrackedAsDiff("src/new.mjs", "a\nb");
  assert.ok(d.startsWith("diff --git a/src/new.mjs b/src/new.mjs\n"));
  assert.ok(d.includes("+a\n+b"));
  assert.deepEqual(filterDiffSections(d).omitted, []);
  assert.deepEqual(filterDiffSections(untrackedAsDiff(".env", "K=1")).omitted, [".env"]);
});

test("untrackedAsDiff: binary-looking content (NUL byte) and non-strings are skipped", () => {
  assert.equal(untrackedAsDiff("a.bin", "x\u0000y"), "");
  assert.equal(untrackedAsDiff("a", undefined), "");
  assert.equal(untrackedAsDiff(undefined, "x"), "");
});

// ---- evidenceMarkerPath ------------------------------------------------------------------------

test("evidenceMarkerPath: same task+diff → same path; a different id or diff → a different path; unsafe input stays a plain file name", () => {
  const a = evidenceMarkerPath("054", "diff-1");
  assert.equal(a, evidenceMarkerPath("054", "diff-1"));
  assert.notEqual(a, evidenceMarkerPath("054", "diff-2"));
  assert.notEqual(a, evidenceMarkerPath("055", "diff-1"));
  assert.match(a, /ccf-jev-[0-9a-f]{16}$/);
  assert.match(evidenceMarkerPath("../../x", "d"), /ccf-jev-[0-9a-f]{16}$/);
});

test("evidenceMarkerPath: non-string input never throws", () => {
  for (const g of [undefined, null, 5, {}]) assert.match(evidenceMarkerPath(g, g), /ccf-jev-[0-9a-f]{16}$/);
});
// ---- default size cap (task 057: measured, the API rejects around 33K input tokens) -------------------

test("default cap: 80KB, applied when the caller passes none; a payload just under it is built, one over it is skipped", () => {
  assert.equal(DEFAULT_CAP_BYTES, 80_000);
  const noCap = { ...BASE, capBytes: undefined };
  const under = buildEvidenceRequest({ ...noCap, diff: SECTION("src/a.mjs", "+" + "x".repeat(70_000)) });
  assert.equal(under.ok, true);
  const over = buildEvidenceRequest({ ...noCap, diff: SECTION("src/a.mjs", "+" + "x".repeat(90_000)) });
  assert.deepEqual(over, { ok: false, reason: "too-large" });
});