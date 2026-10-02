import { test } from "node:test";
import assert from "node:assert/strict";
import { readRuntimeEvidence } from "./runtime-evidence.mjs";

const task = (ui, evidence) =>
  ["# Task 1 — x", "", "- **Vertical slice:** UI", ui == null ? null : `- **Touches UI:** ${ui}`, evidence == null ? null : `- **Runtime evidence:** ${evidence}`, "", "## Goal", "g"]
    .filter((l) => l !== null)
    .join("\n");

test("readRuntimeEvidence: decision table over Touches UI x Runtime evidence", () => {
  const cases = [
    [null, null, false, "", "not-required"],
    [null, "npm run dev -> page renders", false, "npm run dev -> page renders", "not-required"],
    ["no", null, false, "", "not-required"],
    ["no", "", false, "", "not-required"],
    ["yes", null, true, "", "empty"],
    ["yes", "", true, "", "empty"],
    ["yes", "   ", true, "", "empty"],
    ["yes", "not run:", true, "not run:", "empty"],
    ["yes", "not run:   ", true, "not run:", "empty"],
    ["yes", "not run", true, "not run", "empty"],
    ["yes", "not run: no browser", true, "not run: no browser", "not-run"],
    ["yes", "Not Run: no display", true, "Not Run: no display", "not-run"],
    ["yes", "npm run dev, open /login -> form renders, submit shows error", true, "npm run dev, open /login -> form renders, submit shows error", "ran"],
    ["yes", "open /login → form renders", true, "open /login → form renders", "ran"],
    ["yes", "TBD", true, "TBD", "empty"],
    ["yes", "-> renders", true, "-> renders", "empty"],
    ["yes", "npm run dev ->", true, "npm run dev ->", "empty"],
    ["yes", "{{RUNTIME_EVIDENCE}}", true, "", "empty"],
    ["yes", "<!-- fill after the gate -->", true, "", "empty"],
  ];
  for (const [ui, evidence, touchesUi, value, state] of cases) {
    assert.deepEqual(readRuntimeEvidence(task(ui, evidence)), { touchesUi, evidence: value, state }, `${ui} / ${evidence}`);
  }
});

test("readRuntimeEvidence: Touches UI is case-insensitive and tolerates emphasis and comments", () => {
  for (const ui of ["yes", "YES", "Yes", "**yes**", "`yes`", "_yes_", "yes   <!-- the slice renders a page -->"]) {
    assert.equal(readRuntimeEvidence(task(ui, null)).touchesUi, true, ui);
  }
  for (const ui of ["no", "NO", "**no**", "", "{{TOUCHES_UI}}", "maybe", "yes please"]) {
    assert.equal(readRuntimeEvidence(task(ui, null)).touchesUi, false, ui);
  }
});

test("readRuntimeEvidence: emphasis around the evidence value is stripped", () => {
  assert.deepEqual(readRuntimeEvidence(task("**yes**", "**not run: no browser**")), { touchesUi: true, evidence: "not run: no browser", state: "not-run" });
});

test("readRuntimeEvidence: only the field line counts, not prose mentioning it", () => {
  const text = "# T\n\nThe Touches UI: yes field is set in step 5.\n- **Touches UI:** no\n";
  assert.equal(readRuntimeEvidence(text).state, "not-required");
});

test("readRuntimeEvidence: garbage input never throws and needs nothing", () => {
  for (const g of [undefined, null, 5, "", {}, []]) {
    assert.deepEqual(readRuntimeEvidence(g), { touchesUi: false, evidence: "", state: "not-required" });
  }
});

test("readRuntimeEvidence: Touches UI comes from the second text when given, the evidence from the first", () => {
  const flipped = task("no", "");
  const original = task("yes", "");
  assert.deepEqual(readRuntimeEvidence(flipped, original), { touchesUi: true, evidence: "", state: "empty" });
  assert.deepEqual(readRuntimeEvidence(task("no", "open / -> renders"), original), { touchesUi: true, evidence: "open / -> renders", state: "ran" });
  assert.deepEqual(readRuntimeEvidence(task("yes", ""), task("no", null)), { touchesUi: false, evidence: "", state: "not-required" });
  assert.deepEqual(readRuntimeEvidence(original, undefined), readRuntimeEvidence(original));
});
