import { hotspotClasses, mergeSliceAnswers } from "./slice-check.mjs";

const COLLISION_ADVICE =
  "Move the edits to these shared files into one final task that Depends on the others, so the feature tasks can run in parallel.";

function usable(tasks = [{ id: "", title: "", taskFile: "", files: [""], criteria: [""], dependsOn: [""] }]) {
  if (!Array.isArray(tasks)) return [];
  return tasks
    .filter((t) => t && typeof t === "object" && String(t.id ?? "").trim())
    .map((t) => ({
      id: String(t.id).trim(),
      title: String(t.title ?? ""),
      taskFile: t.taskFile ? String(t.taskFile) : null,
      files: Array.isArray(t.files) ? t.files.map(String) : [],
      criteria: Array.isArray(t.criteria) ? t.criteria.map(String) : [],
      dependsOn: Array.isArray(t.dependsOn) ? t.dependsOn.map(String) : [],
    }));
}

function reachability(tasks = [{ id: "", dependsOn: [""] }]) {
  const open = new Set(tasks.map((t) => t.id));
  const direct = new Map(tasks.map((t) => [t.id, t.dependsOn.filter((d) => open.has(d))]));
  const reach = new Map();
  for (const t of tasks) {
    const seen = new Set();
    const stack = [...(direct.get(t.id) ?? [])];
    while (stack.length) {
      const id = stack.pop() ?? "";
      if (seen.has(id)) continue;
      seen.add(id);
      stack.push(...(direct.get(id) ?? []));
    }
    reach.set(t.id, seen);
  }
  return reach;
}

export function lintPlan(input = { tasks: [{ id: "", title: "", taskFile: "", files: [""], criteria: [""], dependsOn: [""] }], knownIds: [""] }) {
  const tasks = usable(input?.tasks);
  const known = new Set(Array.isArray(input?.knownIds) ? input.knownIds.map(String) : []);
  for (const t of tasks) known.add(t.id);
  const findings = [];

  for (const t of tasks) {
    if (!t.taskFile) findings.push({ kind: "no-task-file", id: t.id });
    if (t.files.length === 0) findings.push({ kind: "no-files", id: t.id });
    if (t.criteria.length === 0) findings.push({ kind: "no-criteria", id: t.id });
    for (const d of t.dependsOn) if (!known.has(d)) findings.push({ kind: "unknown-dependency", id: t.id, dependsOn: d });
  }

  const reach = reachability(tasks);
  const cyclic = tasks.filter((t) => reach.get(t.id)?.has(t.id)).map((t) => t.id);
  if (cyclic.length) findings.push({ kind: "dependency-cycle", tasks: cyclic });

  const ordered = (a = "", b = "") => !!reach.get(a)?.has(b) || !!reach.get(b)?.has(a);
  const classes = [...new Set(tasks.flatMap((t) => hotspotClasses(t.files)))];
  for (const hotspot of classes) {
    const touching = tasks.filter((t) => hotspotClasses(t.files).includes(hotspot));
    const clashing = touching.filter((a) => touching.some((b) => b.id !== a.id && !ordered(a.id, b.id)));
    if (clashing.length < 2) continue;
    const files = [...new Set(clashing.flatMap((t) => t.files.filter((f) => hotspotClasses([f]).includes(hotspot))))];
    findings.push({ kind: "hotspot-collision", hotspot, tasks: clashing.map((t) => t.id), files, advice: COLLISION_ADVICE });
  }

  const merged = mergeSliceAnswers(tasks, [], { askedJev: false });
  const edgeCounts = new Map();
  for (const e of merged.edges) edgeCounts.set(e.kind, (edgeCounts.get(e.kind) ?? 0) + 1);
  return { findings, waveCount: merged.waves.length, serial: tasks.length >= 3 && merged.waves.length === tasks.length, edgeKinds: Object.fromEntries(edgeCounts) };
}
