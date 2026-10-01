// Unit tests for lib/memory-audit.mjs (task 071, discipline: on).
// Matrix: EP over frontmatter {typed feedback, typed other, untyped, malformed} and index state
// {clean, dangling, unindexed, both}; BVA on every gate threshold; the 2x2 gate decision table;
// Jev request/label EP + BVA (exact 80KB cap, scores 0 and 1, ties, incomplete answers, zero files).

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseMemoryFrontmatter,
  auditMemory,
  shouldConsolidate,
  buildJevMemoryRequest,
  labelFromAnswers,
  DEFAULT_THRESHOLDS,
} from "./memory-audit.mjs";

/** @param {string} type @param {string} [name] */
function mem(type, name = "x") {
  return `---\nname: ${name}\ndescription: d\nmetadata:\n  type: ${type}\n---\nbody\n`;
}

// ---- parseMemoryFrontmatter (EP) ----

test("frontmatter: typed feedback under metadata", () => {
  const fm = parseMemoryFrontmatter("---\nname: a-b\ndescription: one line\nmetadata:\n  type: feedback\n  modified: 2026-09-01T00:00:00Z\n---\nbody");
  assert.deepEqual(fm, { name: "a-b", description: "one line", type: "feedback", modified: "2026-09-01T00:00:00Z" });
});

test("frontmatter: typed other, top-level type key", () => {
  assert.equal(parseMemoryFrontmatter("---\nname: u\ntype: user\n---\n").type, "user");
  assert.equal(parseMemoryFrontmatter(mem("project")).type, "project");
  assert.equal(parseMemoryFrontmatter(mem("reference")).type, "reference");
});

test("frontmatter: no frontmatter → untyped, never feedback", () => {
  const fm = parseMemoryFrontmatter("just text mentioning type: feedback\n");
  assert.equal(fm.type, "untyped");
  assert.equal(fm.name, "");
});

test("frontmatter: malformed (unclosed) → untyped", () => {
  assert.equal(parseMemoryFrontmatter("---\nname: a\ntype: feedback\nbody without close").type, "untyped");
});

test("frontmatter: unknown type value → untyped; non-string input → untyped", () => {
  assert.equal(parseMemoryFrontmatter(mem("bogus")).type, "untyped");
  assert.equal(parseMemoryFrontmatter(/** @type {any} */ (null)).type, "untyped");
  assert.equal(parseMemoryFrontmatter("").type, "untyped");
});

test("frontmatter: CRLF line endings parse", () => {
  assert.equal(parseMemoryFrontmatter("---\r\nname: a\r\ntype: feedback\r\n---\r\nb").type, "feedback");
});

// ---- auditMemory (EP index state) ----

test("audit: clean index, counts by type, untyped never counts as feedback", () => {
  const r = auditMemory({
    indexText: "- [A](a.md) — h\n- [B](b.md) — h\n- [C](c.md) — h\n",
    files: [
      { name: "a.md", text: mem("feedback") },
      { name: "b.md", text: mem("user") },
      { name: "c.md", text: "no frontmatter" },
    ],
  });
  assert.deepEqual(r.counts, { feedback: 1, user: 1, project: 0, reference: 0, untyped: 1 });
  assert.deepEqual(r.danglingIndex, []);
  assert.deepEqual(r.unindexed, []);
  assert.equal(r.index.lines, 3);
});

test("audit: one dangling link and one unindexed file", () => {
  const r = auditMemory({
    indexText: "- [A](a.md) — h\n- [Gone](gone.md) — h\n",
    files: [{ name: "a.md", text: mem("feedback") }, { name: "lost.md", text: mem("project") }],
  });
  assert.deepEqual(r.danglingIndex, ["gone.md"]);
  assert.deepEqual(r.unindexed, ["lost.md"]);
});

test("audit: dangling only / unindexed only are independent", () => {
  const d = auditMemory({ indexText: "- [A](a.md)\n- [Z](z.md)\n", files: [{ name: "a.md", text: mem("user") }] });
  assert.deepEqual([d.danglingIndex, d.unindexed], [["z.md"], []]);
  const u = auditMemory({ indexText: "", files: [{ name: "a.md", text: mem("user") }] });
  assert.deepEqual([u.danglingIndex, u.unindexed], [[], ["a.md"]]);
});

test("audit: ./ prefix and external links are handled", () => {
  const r = auditMemory({ indexText: "- [A](./a.md)\n- [web](https://x.y/z.md)\n", files: [{ name: "a.md", text: mem("user") }] });
  assert.deepEqual(r.danglingIndex, []);
  assert.deepEqual(r.unindexed, []);
});

test("audit: empty dir and empty index (BVA 0 files)", () => {
  const r = auditMemory({ indexText: "", files: [] });
  assert.deepEqual(r.counts, { feedback: 0, user: 0, project: 0, reference: 0, untyped: 0 });
  assert.deepEqual(r.index, { lines: 0, bytes: 0 });
  assert.deepEqual(r.files, []);
});

test("audit: index lines and bytes measured, trailing newline not counted as a line", () => {
  const r = auditMemory({ indexText: "a\nb\n", files: [] });
  assert.deepEqual(r.index, { lines: 2, bytes: 4 });
  assert.equal(auditMemory({ indexText: "a\nb", files: [] }).index.lines, 2);
});

test("audit: files carry file, type and modified", () => {
  const r = auditMemory({ indexText: "", files: [{ name: "a.md", text: "---\ntype: feedback\nmodified: 2026-01-01\n---\n" }, { name: "b.md", text: "x" }] });
  assert.deepEqual(r.files, [{ file: "a.md", type: "feedback", modified: "2026-01-01" }, { file: "b.md", type: "untyped", modified: null }]);
});

// ---- shouldConsolidate (BVA + decision table) ----

const T = DEFAULT_THRESHOLDS;
const quiet = { feedbackCount: 0, indexLines: 0, indexBytes: 0 };

test("thresholds default to 20 / 150 / 20", () => {
  assert.deepEqual(T, { maxFeedback: 20, indexLines: 150, indexKb: 20 });
});

test("BVA feedback: 20 closed, 21 open", () => {
  assert.deepEqual(shouldConsolidate({ ...quiet, feedbackCount: 20 }, T), { gate: false, reasons: [] });
  assert.deepEqual(shouldConsolidate({ ...quiet, feedbackCount: 21 }, T), { gate: true, reasons: ["feedback-count"] });
});

test("BVA index lines: 149 closed, 150 open", () => {
  assert.equal(shouldConsolidate({ ...quiet, indexLines: 149 }, T).gate, false);
  assert.deepEqual(shouldConsolidate({ ...quiet, indexLines: 150 }, T), { gate: true, reasons: ["index-lines"] });
});

test("BVA index bytes: 20479 closed, 20480 open", () => {
  assert.equal(shouldConsolidate({ ...quiet, indexBytes: 20479 }, T).gate, false);
  assert.deepEqual(shouldConsolidate({ ...quiet, indexBytes: 20480 }, T), { gate: true, reasons: ["index-bytes"] });
});

test("decision table: feedback gate × index gate", () => {
  const rows = [
    [20, 149, false, []],
    [21, 149, true, ["feedback-count"]],
    [20, 150, true, ["index-lines"]],
    [21, 150, true, ["feedback-count", "index-lines"]],
  ];
  for (const [f, l, gate, reasons] of rows) {
    assert.deepEqual(shouldConsolidate({ feedbackCount: /** @type {number} */ (f), indexLines: /** @type {number} */ (l), indexBytes: 0 }, T), { gate, reasons });
  }
});

test("all three thresholds crossed → every reason listed", () => {
  assert.deepEqual(shouldConsolidate({ feedbackCount: 99, indexLines: 999, indexBytes: 99999 }, T).reasons, ["feedback-count", "index-lines", "index-bytes"]);
});

test("missing thresholds fall back to defaults; bad counts read as 0", () => {
  assert.equal(shouldConsolidate({ ...quiet, feedbackCount: 21 }).gate, true);
  assert.equal(shouldConsolidate(/** @type {any} */ ({ feedbackCount: "x" })).gate, false);
});

// ---- buildJevMemoryRequest ----

test("jev request: three Nouls per file, state carries every text and the index", () => {
  const files = [{ name: "a.md", text: mem("feedback", "a") }, { name: "b.md", text: mem("user", "b") }];
  const r = buildJevMemoryRequest(files, "- [A](a.md)\n");
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.deepEqual(Object.keys(r.questions), ["a.md::keep", "a.md::merge", "a.md::drop", "b.md::keep", "b.md::merge", "b.md::drop"]);
  for (const q of Object.values(r.questions)) assert.equal(q.type, "noul");
  assert.equal(r.state.index, "- [A](a.md)\n");
  assert.deepEqual(r.state.memories, [{ file: "a.md", text: files[0].text }, { file: "b.md", text: files[1].text }]);
});

test("jev request: zero files → nothing-to-ask", () => {
  assert.deepEqual(buildJevMemoryRequest([], "- [A](a.md)\n".repeat(200)), { ok: false, reason: "nothing-to-ask" });
});

test("jev request BVA: state at exactly the cap is sent, cap + 1 byte is too-large", () => {
  const cap = 80_000;
  /** @param {number} n */
  const sized = (n) => JSON.stringify({ index: "", memories: [{ file: "a.md", text: "a".repeat(n) }] }).length;
  const overhead = sized(0);
  const atCap = buildJevMemoryRequest([{ name: "a.md", text: "a".repeat(cap - overhead) }], "", cap);
  assert.equal(atCap.ok, true);
  const over = buildJevMemoryRequest([{ name: "a.md", text: "a".repeat(cap - overhead + 1) }], "", cap);
  assert.deepEqual(over, { ok: false, reason: "too-large" });
});

test("jev request: default cap is 80000 bytes", () => {
  assert.deepEqual(buildJevMemoryRequest([{ name: "a.md", text: "a".repeat(80_001) }], ""), { ok: false, reason: "too-large" });
});

// ---- labelFromAnswers ----

const ONE = [{ name: "a.md" }];

test("label winner keep / merge / drop", () => {
  assert.deepEqual(labelFromAnswers({ "a.md::keep": { noul: 0.9 }, "a.md::merge": { noul: 0.2 }, "a.md::drop": { noul: 0.1 } }, ONE), { "a.md": { label: "keep", score: 0.9 } });
  assert.deepEqual(labelFromAnswers({ "a.md::keep": { noul: 0.1 }, "a.md::merge": { noul: 0.7 }, "a.md::drop": { noul: 0.1 } }, ONE), { "a.md": { label: "merge", score: 0.7 } });
  assert.deepEqual(labelFromAnswers({ "a.md::keep": { noul: 0.1 }, "a.md::merge": { noul: 0.2 }, "a.md::drop": { noul: 0.82 } }, ONE), { "a.md": { label: "drop", score: 0.82 } });
});

test("label tie-break: least destructive wins (keep > merge > drop)", () => {
  assert.equal(labelFromAnswers({ "a.md::keep": { noul: 0.5 }, "a.md::merge": { noul: 0.5 }, "a.md::drop": { noul: 0.5 } }, ONE)["a.md"].label, "keep");
  assert.equal(labelFromAnswers({ "a.md::keep": { noul: 0.1 }, "a.md::merge": { noul: 0.6 }, "a.md::drop": { noul: 0.6 } }, ONE)["a.md"].label, "merge");
});

test("label BVA: scores 0 and 1 are valid", () => {
  assert.deepEqual(labelFromAnswers({ "a.md::keep": { noul: 0 }, "a.md::merge": { noul: 0 }, "a.md::drop": { noul: 1 } }, ONE), { "a.md": { label: "drop", score: 1 } });
  assert.deepEqual(labelFromAnswers({ "a.md::keep": { noul: 0 }, "a.md::merge": { noul: 0 }, "a.md::drop": { noul: 0 } }, ONE), { "a.md": { label: "keep", score: 0 } });
});

test("label: one answer missing or malformed → no entry; others still labelled", () => {
  const files = [{ name: "a.md" }, { name: "b.md" }, { name: "c.md" }];
  const out = labelFromAnswers({
    "a.md::keep": { noul: 0.9 }, "a.md::merge": { noul: 0.1 }, "a.md::drop": { noul: 0.1 },
    "b.md::keep": { noul: 0.9 }, "b.md::drop": { noul: 0.1 },
    "c.md::keep": { noul: 1.5 }, "c.md::merge": { noul: 0.1 }, "c.md::drop": { noul: 0.1 },
  }, files);
  assert.deepEqual(Object.keys(out), ["a.md"]);
});

test("label: no answers at all / bad input → empty", () => {
  assert.deepEqual(labelFromAnswers({}, ONE), {});
  assert.deepEqual(labelFromAnswers(/** @type {any} */ (null), ONE), {});
  assert.deepEqual(labelFromAnswers(/** @type {any} */ ([]), /** @type {any} */ (null)), {});
});
