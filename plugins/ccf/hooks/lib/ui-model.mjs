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

const PLAN_WAVES_RUN = /plan-waves\.mjs(["'\s]|$)/;

export function isPlanWavesRun(command = "") {
  return PLAN_WAVES_RUN.test(String(command ?? ""));
}

function flagValue(command = "", flag = "") {
  const found = command.match(new RegExp(`${flag}\\s+(?:"([^"]*)"|'([^']*)'|([^\\s"';|&>]+))`));
  if (!found) return undefined;
  return found[1] ?? found[2] ?? found[3];
}

export function planWavesRequest(command = "") {
  const text = String(command ?? "");
  return { dir: flagValue(text, "--dir"), tasks: flagValue(text, "--tasks") };
}

export function wavesFromOutput(output = "") {
  const text = String(output ?? "");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) return null;
  try {
    const plan = JSON.parse(text.slice(start, end + 1));
    return plan?.ok === true && Array.isArray(plan.waves) ? plan.waves : null;
  } catch {
    return null;
  }
}

export function waveRows(waves = [[NO_WAVE_TASK]], agents = [NO_AGENT], closedIds = [""]) {
  return waves.map((wave) =>
    wave.map((task) => {
      const mine = agents.filter((agent) => agent.taskId === task.id);
      const state = closedIds.includes(task.id) ? "done" : mine.length === 0 ? "waiting" : mine.every((agent) => agent.isDone) ? "done" : "running";
      return { id: task.id, title: task.title, state };
    }),
  );
}

export function closedTaskIds(snapshot = NO_SNAPSHOT) {
  return (snapshot?.tasks ?? []).filter((task) => task.column === "in-review" || task.column === "done").map((task) => task.id);
}

export function liveAgents(agents = [NO_AGENT]) {
  return agents.filter((agent) => !agent.isDone);
}

const PLAN_WRITE_TOOLS = new Set(["Edit", "Write", "MultiEdit"]);

export function isPlanWrite(tool = "", filePath = "") {
  return PLAN_WRITE_TOOLS.has(tool) && /(^|[\\/])\.claude[\\/]plan[\\/]PLAN\.md$/.test(String(filePath ?? ""));
}

export function isCookTaskBrief(text = "") {
  return /\bworktree-ccf-/.test(String(text ?? ""));
}

export function waveLines(rows = [[{ id: "", title: "", state: "" }]]) {
  return rows.flatMap((wave, index) => [
    { isHeading: true, text: `wave ${index + 1}`, state: "" },
    ...wave.map((task) => ({ isHeading: false, text: `${task.id} ${task.title}`, state: task.state })),
  ]);
}

export function waveSummary(rows = [[{ id: "", title: "", state: "" }]]) {
  const tasks = rows.flat();
  const count = (state = "") => tasks.filter((task) => task.state === state).length;
  return {
    waves: rows.map((wave) => ({ title: wave.map((task) => task.id).join(" "), total: wave.length, done: wave.filter((task) => task.state === "done").length })),
    counts: { done: count("done"), running: count("running"), waiting: count("waiting") },
  };
}

export function scrollWindow(total = 0, offset = 0, visible = 1) {
  const rows = Math.max(1, visible);
  const start = Math.min(Math.max(0, offset), Math.max(0, total - rows));
  const end = Math.min(total, start + rows);
  return { start, end, hiddenAbove: start, hiddenBelow: total - end };
}

export function waveScroll(region = { top: 0, rows: 0, total: 0 }, offset = 0, by = 0, hasPointer = false, pointerRow = 0) {
  if (region.total <= region.rows) return null;
  if (hasPointer && (pointerRow < region.top || pointerRow >= region.top + region.rows)) return null;
  return scrollWindow(region.total, offset + by, region.rows).start;
}

export function hiddenMark(count = 0) {
  return count > 0 ? `.. +${count}` : "";
}

export function wrappedRows(text = "", width = 1) {
  const room = Math.max(1, width);
  let rows = 1;
  let used = 0;
  for (const word of String(text ?? "").split(/\s+/).filter(Boolean)) {
    const size = [...word].length;
    if (used > 0 && used + 1 + size <= room) {
      used += 1 + size;
      continue;
    }
    if (used > 0) rows += 1;
    const extra = Math.floor((size - 1) / room);
    rows += extra;
    used = size - extra * room;
  }
  return rows;
}

const BUBBLE_FRAME_ROWS = 2;
const BUBBLE_FRAME_COLUMNS = 4;
const MIN_WAVE_ROWS = 3;

export function dockLayout({ bodyRows = 0, bodyColumns = 0, line = "", hasBoard = false, waveLineCount = 0, spriteRows = 0 } = {}) {
  const bubbleRows = BUBBLE_FRAME_ROWS + wrappedRows(line, bodyColumns - BUBBLE_FRAME_COLUMNS);
  const hasWaves = waveLineCount > 0;
  const room = (boardRows = 0) => bodyRows - boardRows - (hasBoard ? 1 : 0) - (hasWaves ? 1 : 0) - bubbleRows - spriteRows;
  const boardRows = !hasBoard ? 0 : hasWaves && room(2) < MIN_WAVE_ROWS ? 1 : 2;
  const waveRows = hasWaves ? Math.max(1, Math.min(waveLineCount, room(boardRows))) : 0;
  return { boardRows, waveTop: boardRows + (hasBoard ? 1 : 0), waveRows };
}

export function boardSummary(snapshot = NO_SNAPSHOT) {
  const tasks = snapshot?.tasks ?? [];
  const [todo, doing, review, done] = boardColumns(tasks).map((column) => column.tasks.length);
  const risks = snapshot?.openRisks ?? 0;
  return {
    closed: done,
    total: tasks.length,
    headline: `${done}/${tasks.length} closed · ${risks} risk${risks === 1 ? "" : "s"}`,
    counts: `todo ${todo} · doing ${doing} · review ${review} · done ${done}`,
  };
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

export const NO_TASK_LINE = "Chưa có task nào. Gõ /ccf:plan nhé.";

export function dockIsEmpty(snapshot = NO_SNAPSHOT, waveLineCount = 0) {
  return waveLineCount === 0 && !((snapshot?.tasks?.length ?? 0) > 0);
}

export function walkStep({ x = 0, dir = 1 } = {}, room = 0) {
  if (!(room > 0)) return { x: 0, dir: 1 };
  const clamped = Math.min(Math.max(0, x), room);
  const next = clamped + dir;
  if (next > room) return { x: room - 1, dir: -1 };
  if (next < 0) return { x: Math.min(1, room), dir: 1 };
  return { x: next, dir };
}
