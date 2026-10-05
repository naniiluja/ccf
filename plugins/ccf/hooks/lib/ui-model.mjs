export const LIFECYCLE = ["todo", "in-progress", "in-review", "done"];

const NEXT_COMMAND = new Map([["todo", "/ccf:cook"], ["in-progress", "/ccf:cook"], ["in-review", "/ccf:check"], ["done", "/ccf:plan"]]);
const NO_TASK = { id: "", title: "", status: "", column: "" };
const NO_SNAPSHOT = { ok: false, active: NO_TASK, tasks: [NO_TASK], openRisks: 0, specStale: false };
const NO_WAVE_TASK = { id: "", title: "", taskFile: "", worktree: "", branch: "" };
const NO_AGENT = { agentId: "", taskId: "", isDone: false };

export function columnOf(status = "", isClosed = false) {
  if (isClosed) return "done";
  if (/^in[-\s]?review$/i.test(status)) return "in-review";
  if (/^in[-\s]?progress$/i.test(status)) return "in-progress";
  return "todo";
}

export function lifecycleTrack(column = "") {
  const at = LIFECYCLE.indexOf(column);
  return LIFECYCLE.map((_, i) => (i < at ? "●" : i === at ? "◉" : "○")).join("━━");
}

export function nextCommand(column = "") {
  return NEXT_COMMAND.get(column) ?? "/ccf:plan";
}

export function bandLine(snapshot = NO_SNAPSHOT) {
  if (!snapshot || snapshot.ok !== true) return null;
  const active = snapshot.active;
  if (active && active.id) {
    const command = nextCommand(active.column);
    return { text: `${active.id} ${lifecycleTrack(active.column)} ${active.status} · next: ${command}`, command };
  }
  const todo = (snapshot.tasks ?? []).filter((task) => task.column === "todo").length;
  if (todo > 0) return { text: `CCF · ${todo} todo · next: /ccf:cook`, command: "/ccf:cook" };
  return { text: "CCF · no open task · next: /ccf:plan", command: "/ccf:plan" };
}

export function boardColumns(tasks = [NO_TASK]) {
  return LIFECYCLE.map((column) => ({ column, tasks: tasks.filter((task) => task.column === column) }));
}

export function claudeMdBudget(report = { files: [{ path: "", bytes: 0, lines: 0, depth: 0 }], total: 0, claudeMdOver: false, limits: { lines: 0, bytes: 0 } }) {
  const root = (report?.files ?? []).find((file) => file.depth === 0);
  if (!root) return null;
  return {
    bytes: root.bytes,
    lines: root.lines,
    total: report.total,
    isOver: report.claudeMdOver === true,
    maxBytes: report.limits?.bytes ?? 0,
    maxLines: report.limits?.lines ?? 0,
  };
}

function kilobytes(bytes = 0) {
  return (bytes / 1024).toFixed(1).replace(/\.0$/, "");
}

export function statusText(specStale = false, budget = { bytes: 0, lines: 0, total: 0, isOver: false, maxBytes: 0, maxLines: 0 }) {
  if (specStale !== true && specStale !== false) return undefined;
  const parts = ["CCF", specStale ? "spec older than code: /ccf:updatespec" : "spec fresh"];
  if (budget) {
    parts.push(`CLAUDE.md ${kilobytes(budget.bytes)}/${kilobytes(budget.maxBytes)}KB, ${budget.lines} lines${budget.isOver ? " (over limit)" : ""}`);
    parts.push(`paid ${kilobytes(budget.total)}KB`);
  }
  return parts.join(" · ");
}

export function matchWaveTask(waves = [[NO_WAVE_TASK]], text = "") {
  for (const wave of waves) {
    for (const task of wave) {
      const marks = [task.taskFile, task.worktree, task.branch, `task-${task.id}-`].filter(Boolean);
      if (marks.some((mark) => text.includes(mark))) return task.id;
    }
  }
  return null;
}

export function waveRows(waves = [[NO_WAVE_TASK]], agents = [NO_AGENT]) {
  return waves.map((wave) =>
    wave.map((task) => {
      const mine = agents.filter((agent) => agent.taskId === task.id);
      const state = mine.length === 0 ? "waiting" : mine.every((agent) => agent.isDone) ? "done" : "running";
      return { id: task.id, title: task.title, state };
    }),
  );
}

export function boardCommands(snapshot = NO_SNAPSHOT) {
  const tasks = snapshot?.tasks ?? [];
  const has = (column = "") => tasks.some((task) => task.column === column);
  const commands = [];
  if (has("in-review")) commands.push("/ccf:check");
  if (has("todo") || has("in-progress")) commands.push("/ccf:cook");
  if (snapshot?.specStale === true) commands.push("/ccf:updatespec");
  commands.push("/ccf:plan");
  return commands;
}

const FULL_BLOCK = 0x2588;
const LIGHT_SHADE = 0x2591;
const DONE_COLOR = 0x5fb36b;
const OPEN_COLOR = 0x6b6b6b;
const DEFAULT_COLOR = 0x01000000;

function filledCount(done = 0, total = 0, width = 0) {
  return total > 0 ? Math.round((done / total) * width) : 0;
}

export function progressCells(done = 0, total = 0, width = 1) {
  const filled = filledCount(done, total, width);
  const view = new DataView(new ArrayBuffer(width * 12));
  for (let i = 0; i < width; i++) {
    const isFilled = i < filled;
    view.setUint32(i * 12, isFilled ? FULL_BLOCK : LIGHT_SHADE, true);
    view.setUint32(i * 12 + 4, isFilled ? DONE_COLOR : OPEN_COLOR, true);
    view.setUint32(i * 12 + 8, DEFAULT_COLOR, true);
  }
  let binary = "";
  for (const byte of new Uint8Array(view.buffer)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function progressSvg(done = 0, total = 0, width = 200) {
  const filled = filledCount(done, total, width);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="8" viewBox="0 0 ${width} 8"><rect x="0" y="0" width="${width}" height="8" rx="4" fill="#6b6b6b" opacity="0.35"/><rect x="0" y="0" width="${filled}" height="8" rx="4" fill="#5fb36b"/></svg>`;
}
