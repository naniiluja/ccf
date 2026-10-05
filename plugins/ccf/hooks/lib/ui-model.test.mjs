import { test } from "node:test";
import assert from "node:assert/strict";
import {
  columnOf,
  lifecycleTrack,
  nextCommand,
  bandLine,
  boardColumns,
  claudeMdBudget,
  statusText,
  matchWaveTask,
  waveRows,
  progressCells,
  isPlanWavesRun,
  planWavesRequest,
  wavesFromOutput,
  closedTaskIds,
  liveAgents,
  isCookTaskBrief,
  waveLines,
  waveSummary,
  scrollWindow,
  waveScroll,
  hiddenMark,
  wrappedRows,
  dockLayout,
  boardSummary,
  isPlanWrite,
  dockIsEmpty,
  NO_TASK_LINE,
} from "./ui-model.mjs";

test("columnOf maps statuses to the four lifecycle columns", () => {
  assert.equal(columnOf("todo", false), "todo");
  assert.equal(columnOf("in-progress", false), "in-progress");
  assert.equal(columnOf("In Progress", false), "in-progress");
  assert.equal(columnOf("in-review", false), "in-review");
  assert.equal(columnOf("blocked", false), "todo");
  assert.equal(columnOf("accepted", true), "done");
  assert.equal(columnOf("in-review", true), "done");
});

test("lifecycleTrack marks passed, current and future steps", () => {
  assert.equal(lifecycleTrack("todo"), "◉━━○━━○━━○");
  assert.equal(lifecycleTrack("in-review"), "●━━●━━◉━━○");
  assert.equal(lifecycleTrack("done"), "●━━●━━●━━◉");
});

test("nextCommand names the CCF command each column waits on", () => {
  assert.equal(nextCommand("todo"), "/ccf:cook");
  assert.equal(nextCommand("in-progress"), "/ccf:cook");
  assert.equal(nextCommand("in-review"), "/ccf:check");
  assert.equal(nextCommand("done"), "/ccf:plan");
});

const SNAPSHOT = {
  ok: true,
  active: { id: "070", title: "prune-archive", status: "in-review", column: "in-review" },
  tasks: [
    { id: "070", title: "prune-archive", status: "in-review", column: "in-review" },
    { id: "073", title: "exit code", status: "done", column: "done" },
    { id: "075", title: "new", status: "todo", column: "todo" },
  ],
  openRisks: 8,
  specStale: true,
};

test("bandLine shows the active task, its track and the next command", () => {
  assert.deepEqual(bandLine(SNAPSHOT), {
    text: "070 ●━━●━━◉━━○ in-review · next: /ccf:check",
    command: "/ccf:check",
  });
});

test("bandLine falls back to the backlog or to planning when nothing is active", () => {
  assert.deepEqual(bandLine({ ...SNAPSHOT, active: null }), { text: "CCF · 1 todo · next: /ccf:cook", command: "/ccf:cook" });
  assert.deepEqual(bandLine({ ...SNAPSHOT, active: null, tasks: [] }), { text: "CCF · no open task · next: /ccf:plan", command: "/ccf:plan" });
  assert.equal(bandLine({ ok: false }), null);
  assert.equal(bandLine(null), null);
});

test("boardColumns groups tasks in lifecycle order", () => {
  const columns = boardColumns(SNAPSHOT.tasks);
  assert.deepEqual(columns.map((c) => c.column), ["todo", "in-progress", "in-review", "done"]);
  assert.deepEqual(columns.map((c) => c.tasks.map((t) => t.id)), [["075"], [], ["070"], ["073"]]);
});

test("claudeMdBudget reads the depth-0 file of spec-budget output", () => {
  const budget = claudeMdBudget({ files: [{ path: "CLAUDE.md", bytes: 7600, lines: 40, depth: 0 }, { path: "a.md", bytes: 10, lines: 1, depth: 1 }], total: 7610, claudeMdOver: false, limits: { lines: 200, bytes: 12288 } });
  assert.deepEqual(budget, { bytes: 7600, lines: 40, total: 7610, isOver: false, maxBytes: 12288, maxLines: 200 });
  assert.equal(claudeMdBudget({ files: [] }), null);
  assert.equal(claudeMdBudget({ error: "x" }), null);
});

test("statusText joins freshness and CLAUDE.md size", () => {
  const budget = { bytes: 7600, lines: 40, total: 61000, isOver: false, maxBytes: 12288, maxLines: 200 };
  assert.equal(statusText(true, budget), "CCF · spec older than code: /ccf:updatespec · CLAUDE.md 7.4/12KB, 40 lines · paid 59.6KB");
  assert.equal(statusText(false, null), "CCF · spec fresh");
  assert.equal(statusText(false, { ...budget, isOver: true }), "CCF · spec fresh · CLAUDE.md 7.4/12KB, 40 lines (over limit) · paid 59.6KB");
  assert.equal(statusText(null, null), undefined);
});

const WAVES = [
  [{ id: "070", title: "a", taskFile: "task-070-a.md", worktree: "ccf-x-070", branch: "worktree-ccf-x-070" }, { id: "071", title: "b", taskFile: "task-071-b.md", worktree: "ccf-x-071", branch: "worktree-ccf-x-071" }],
  [{ id: "072", title: "c", taskFile: "task-072-c.md", worktree: "ccf-x-072", branch: "worktree-ccf-x-072" }],
];

test("matchWaveTask finds the task an agent brief names", () => {
  assert.equal(matchWaveTask(WAVES, "Implement .claude/plan/task-071-b.md in your worktree"), "071");
  assert.equal(matchWaveTask(WAVES, "branch worktree-ccf-x-072"), "072");
  assert.equal(matchWaveTask(WAVES, "Explore the repo"), null);
  assert.equal(matchWaveTask([], "task-070-a.md"), null);
});

test("waveRows marks each task waiting, running or done", () => {
  const rows = waveRows(WAVES, [{ agentId: "a1", taskId: "070", isDone: true }, { agentId: "a2", taskId: "071", isDone: false }]);
  assert.deepEqual(rows.map((wave) => wave.map((t) => `${t.id}:${t.state}`)), [["070:done", "071:running"], ["072:waiting"]]);
});

test("progressCells packs a one-row Raster of filled and empty cells", () => {
  const bytes = Uint8Array.from(atob(progressCells(1, 4, 8)), (c) => c.charCodeAt(0));
  const view = new DataView(bytes.buffer);
  assert.equal(bytes.length, 8 * 12);
  const glyphs = Array.from({ length: 8 }, (_, i) => view.getUint32(i * 12, true));
  assert.deepEqual(glyphs, [0x2588, 0x2588, 0x2591, 0x2591, 0x2591, 0x2591, 0x2591, 0x2591]);
  assert.equal(Uint8Array.from(atob(progressCells(0, 0, 3)), (c) => c.charCodeAt(0)).length, 36);
});

test("isPlanWavesRun spots the /ccf:cook step 2 call and nothing else", () => {
  assert.equal(isPlanWavesRun('node "/cache/ccf/scripts/plan-waves.mjs" --tasks 070,071'), true);
  assert.equal(isPlanWavesRun("node C:\\ccf\\scripts\\plan-waves.mjs"), true);
  assert.equal(isPlanWavesRun("cat scripts/plan-waves.mjs.bak"), false);
  assert.equal(isPlanWavesRun("npm test"), false);
  assert.equal(isPlanWavesRun(undefined), false);
});

test("planWavesRequest reads --dir and --tasks, quoted or bare", () => {
  assert.deepEqual(planWavesRequest('node "/x/plan-waves.mjs" --dir "/home/me/my app" --tasks 070,071'), { dir: "/home/me/my app", tasks: "070,071" });
  assert.deepEqual(planWavesRequest("node /x/plan-waves.mjs --tasks '070,072' --dir /p"), { dir: "/p", tasks: "070,072" });
  assert.deepEqual(planWavesRequest("node /x/plan-waves.mjs --tasks 070|jq ."), { dir: undefined, tasks: "070" });
  assert.deepEqual(planWavesRequest("node /x/plan-waves.mjs"), { dir: undefined, tasks: undefined });
});

test("wavesFromOutput keeps only an ok plan with a waves array", () => {
  const waves = [[{ id: "070", title: "a", taskFile: null, worktree: null, branch: null }]];
  assert.deepEqual(wavesFromOutput(JSON.stringify({ ok: true, waves }, null, 2)), waves);
  assert.deepEqual(wavesFromOutput(`warning: x\n${JSON.stringify({ ok: true, waves })}\n`), waves);
  assert.equal(wavesFromOutput(JSON.stringify({ ok: false, reason: "no-plan" })), null);
  assert.equal(wavesFromOutput("{ not json"), null);
  assert.equal(wavesFromOutput(""), null);
  assert.equal(wavesFromOutput(undefined), null);
});

test("waveRows marks a task PLAN.md already closed as done even with no agent seen", () => {
  const rows = waveRows(WAVES, [{ agentId: "a2", taskId: "071", isDone: false }], ["070", "071"]);
  assert.deepEqual(rows.map((wave) => wave.map((t) => `${t.id}:${t.state}`)), [["070:done", "071:done"], ["072:waiting"]]);
});

test("closedTaskIds keeps in-review and done tasks only", () => {
  const snapshot = { ok: true, active: null, openRisks: 0, specStale: false, tasks: ["todo", "in-progress", "in-review", "done"].map((column, i) => ({ id: `0${i}`, title: "", status: column, column })) };
  assert.deepEqual(closedTaskIds(snapshot), ["02", "03"]);
  assert.deepEqual(closedTaskIds(null), []);
  assert.deepEqual(closedTaskIds(undefined), []);
});

test("liveAgents drops finished agents and keeps running ones", () => {
  assert.deepEqual(liveAgents([{ agentId: "a", taskId: "070", isDone: true }, { agentId: "b", taskId: "071", isDone: false }]), [{ agentId: "b", taskId: "071", isDone: false }]);
  assert.deepEqual(liveAgents([]), []);
});

test("isCookTaskBrief spots a /ccf:cook task brief by its worktree branch", () => {
  assert.equal(isCookTaskBrief("Task: 071. Branch: `worktree-ccf-lc-071`."), true);
  assert.equal(isCookTaskBrief("Explore the repo for worktree helpers"), false);
  assert.equal(isCookTaskBrief(undefined), false);
});

test("waveLines puts a heading before each wave's tasks", () => {
  const lines = waveLines(waveRows(WAVES, []));
  assert.deepEqual(lines.map((line) => `${line.isHeading ? "#" : line.state}:${line.text}`), ["#:wave 1", "waiting:070 a", "waiting:071 b", "#:wave 2", "waiting:072 c"]);
  assert.deepEqual(waveLines([]), []);
});

test("scrollWindow clamps the offset and counts the hidden rows on each side", () => {
  assert.deepEqual(scrollWindow(5, 0, 3), { start: 0, end: 3, hiddenAbove: 0, hiddenBelow: 2 });
  assert.deepEqual(scrollWindow(5, 2, 3), { start: 2, end: 5, hiddenAbove: 2, hiddenBelow: 0 });
  assert.deepEqual(scrollWindow(5, 9, 3), { start: 2, end: 5, hiddenAbove: 2, hiddenBelow: 0 });
  assert.deepEqual(scrollWindow(5, -4, 3), { start: 0, end: 3, hiddenAbove: 0, hiddenBelow: 2 });
  assert.deepEqual(scrollWindow(2, 1, 3), { start: 0, end: 2, hiddenAbove: 0, hiddenBelow: 0 });
  assert.deepEqual(scrollWindow(4, 1, 0), { start: 1, end: 2, hiddenAbove: 1, hiddenBelow: 2 });
});

test("waveScroll moves only a wave list taller than its rows, under the pointer or by key", () => {
  const region = { top: 3, rows: 3, total: 5 };
  assert.equal(waveScroll(region, 0, 1, false, 0), 1);
  assert.equal(waveScroll(region, 0, 1, true, 3), 1);
  assert.equal(waveScroll(region, 0, 1, true, 5), 1);
  assert.equal(waveScroll(region, 1, 9, true, 4), 2);
  assert.equal(waveScroll(region, 1, -9, false, 0), 0);
  assert.equal(waveScroll(region, 0, 1, true, 2), null);
  assert.equal(waveScroll(region, 0, 1, true, 6), null);
  assert.equal(waveScroll(region, 0, 1, true, -1), null);
  assert.equal(waveScroll({ top: 0, rows: 5, total: 5 }, 0, 1, false, 0), null);
});

test("hiddenMark shows the hidden row count, or nothing", () => {
  assert.equal(hiddenMark(3), ".. +3");
  assert.equal(hiddenMark(0), "");
});

test("wrappedRows counts the rows a word-wrapped line takes", () => {
  assert.equal(wrappedRows("", 10), 1);
  assert.equal(wrappedRows("Rem đây", 10), 1);
  assert.equal(wrappedRows("aaaa bbbb cccc", 9), 2);
  assert.equal(wrappedRows("aaaa bbbb", 9), 1);
  assert.equal(wrappedRows("abcdefghijkl", 5), 3);
  assert.equal(wrappedRows("ab abcdefghij", 5), 3);
  assert.equal(wrappedRows("anything", 0), 8);
});

test("dockLayout gives the wave list what the board, dividers, bubble and sprite leave", () => {
  const base = { bodyColumns: 40, line: "short", spriteRows: 15 };
  assert.deepEqual(dockLayout({ ...base, bodyRows: 40, hasBoard: true, waveLineCount: 5 }), { boardRows: 2, waveTop: 3, waveRows: 5 });
  assert.deepEqual(dockLayout({ ...base, bodyRows: 25, hasBoard: true, waveLineCount: 5 }), { boardRows: 2, waveTop: 3, waveRows: 3 });
  assert.deepEqual(dockLayout({ ...base, bodyRows: 24, hasBoard: true, waveLineCount: 5 }), { boardRows: 1, waveTop: 2, waveRows: 3 });
  assert.deepEqual(dockLayout({ ...base, bodyRows: 10, hasBoard: true, waveLineCount: 5 }), { boardRows: 1, waveTop: 2, waveRows: 1 });
  assert.deepEqual(dockLayout({ ...base, bodyRows: 30, hasBoard: false, waveLineCount: 5 }), { boardRows: 0, waveTop: 0, waveRows: 5 });
  assert.deepEqual(dockLayout({ ...base, bodyRows: 30, hasBoard: true, waveLineCount: 0 }), { boardRows: 2, waveTop: 3, waveRows: 0 });
  assert.equal(dockLayout({ ...base, line: "x ".repeat(60), bodyRows: 30, hasBoard: false, waveLineCount: 20 }).waveRows, 8);
});

test("boardSummary condenses the board into a headline and per-column counts", () => {
  assert.deepEqual(boardSummary(SNAPSHOT), {
    closed: 1,
    total: 3,
    headline: "1/3 closed · 8 risks",
    counts: "todo 1 · doing 0 · review 1 · done 1",
  });
  assert.equal(boardSummary({ ...SNAPSHOT, openRisks: 1 }).headline, "1/3 closed · 1 risk");
  assert.equal(boardSummary(null).headline, "0/0 closed · 0 risks");
});

test("isPlanWrite is true only for a file-write tool on .claude/plan/PLAN.md", () => {
  assert.equal(isPlanWrite("Edit", "/project/.claude/plan/PLAN.md"), true);
  assert.equal(isPlanWrite("Write", "C:\\project\\.claude\\plan\\PLAN.md"), true);
  assert.equal(isPlanWrite("MultiEdit", ".claude/plan/PLAN.md"), true);
  assert.equal(isPlanWrite("Read", "/project/.claude/plan/PLAN.md"), false);
  assert.equal(isPlanWrite("Edit", "/project/.claude/plan/task-070-a.md"), false);
  assert.equal(isPlanWrite("Edit", "/project/.claude/plan/ARCHIVE.md"), false);
  assert.equal(isPlanWrite("Edit", "/project/docs/PLAN.md"), false);
  assert.equal(isPlanWrite("Edit", undefined), false);
});

test("dockIsEmpty is true only when no wave line and no PLAN.md task exist", () => {
  assert.equal(dockIsEmpty(null, 0), true);
  assert.equal(dockIsEmpty({ ...SNAPSHOT, tasks: [] }, 0), true);
  assert.equal(dockIsEmpty(SNAPSHOT, 0), false);
  assert.equal(dockIsEmpty(null, 3), false);
  assert.equal(dockIsEmpty({ ok: true }, 0), true);
  assert.match(NO_TASK_LINE, /Chưa có task nào/);
  assert.match(NO_TASK_LINE, /\/ccf:plan/);
  assert.ok([...NO_TASK_LINE].length <= 36);
});

import { walkStep } from "./ui-model.mjs";

test("walkStep moves one cell and bounces at both edges", () => {
  assert.deepEqual(walkStep({ x: 0, dir: 1 }, 5), { x: 1, dir: 1 });
  assert.deepEqual(walkStep({ x: 5, dir: 1 }, 5), { x: 4, dir: -1 });
  assert.deepEqual(walkStep({ x: 0, dir: -1 }, 5), { x: 1, dir: 1 });
  assert.deepEqual(walkStep({ x: 3, dir: -1 }, 5), { x: 2, dir: -1 });
});

test("walkStep stays home when there is no room, and clamps after a resize", () => {
  assert.deepEqual(walkStep({ x: 4, dir: 1 }, 0), { x: 0, dir: 1 });
  assert.deepEqual(walkStep({ x: 9, dir: 1 }, 3), { x: 2, dir: -1 });
});

test("waveSummary counts states and per-wave totals", () => {
  const rows = waveRows(WAVES, [{ agentId: "a", taskId: "070", isDone: false }], ["071"]);
  const summary = waveSummary(rows);
  assert.deepEqual(summary.counts, { done: 1, running: 1, waiting: WAVES.flat().length - 2 });
  assert.equal(summary.waves.length, WAVES.length);
  assert.equal(summary.waves[0].total, WAVES[0].length);
  assert.equal(summary.waves[0].done, 1);
});

test("waveSummary of nothing has no waves and zero counts", () => {
  assert.deepEqual(waveSummary([]), { waves: [], counts: { done: 0, running: 0, waiting: 0 } });
});
