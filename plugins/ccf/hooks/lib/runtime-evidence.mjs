const cleanValue = (raw = "") =>
  raw
    .replace(/<!--[\s\S]*?(-->|$)/g, "")
    .replace(/\{\{[^}]*\}\}/g, "")
    .trim()
    .replace(/^[*_`\s]+|[*_`\s]+$/g, "");

const fieldValue = (text = "", label = "") => {
  const line = text
    .split(/\r?\n/)
    .find((l) => new RegExp(`^\\s*(?:[-*+]\\s+)?\\*\\*${label}:\\*\\*`, "i").test(l));
  return line === undefined ? "" : cleanValue(line.replace(new RegExp(`^.*?\\*\\*${label}:\\*\\*`, "i"), ""));
};

const evidenceState = (evidence = "") => {
  if (/^not run\b/i.test(evidence)) return /^not run:\s*\S/i.test(evidence) ? "not-run" : "empty";
  return /\S\s*(->|→)\s*\S/.test(evidence) ? "ran" : "empty";
};

export function readRuntimeEvidence(taskText = "") {
  const text = typeof taskText === "string" ? taskText : "";
  const touchesUi = fieldValue(text, "Touches UI").toLowerCase() === "yes";
  const evidence = fieldValue(text, "Runtime evidence");
  return { touchesUi, evidence, state: touchesUi ? evidenceState(evidence) : "not-required" };
}
