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
  boardCommands,
  progressCells,
  progressSvg,
  isPlanWavesRun,
  planWavesRequest,
  wavesFromOutput,
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

test("boardCommands offers only the commands the board state calls for", () => {
  assert.deepEqual(boardCommands(SNAPSHOT), ["/ccf:check", "/ccf:cook", "/ccf:updatespec", "/ccf:plan"]);
  assert.deepEqual(boardCommands({ ...SNAPSHOT, tasks: [], specStale: false }), ["/ccf:plan"]);
});

test("progressCells packs a one-row Raster of filled and empty cells", () => {
  const bytes = Uint8Array.from(atob(progressCells(1, 4, 8)), (c) => c.charCodeAt(0));
  const view = new DataView(bytes.buffer);
  assert.equal(bytes.length, 8 * 12);
  const glyphs = Array.from({ length: 8 }, (_, i) => view.getUint32(i * 12, true));
  assert.deepEqual(glyphs, [0x2588, 0x2588, 0x2591, 0x2591, 0x2591, 0x2591, 0x2591, 0x2591]);
  assert.equal(Uint8Array.from(atob(progressCells(0, 0, 3)), (c) => c.charCodeAt(0)).length, 36);
});

test("progressSvg draws the closed share as a rect with alt text", () => {
  const svg = progressSvg(1, 4, 200);
  assert.match(svg, /^<svg [^>]*width="200"/);
  assert.match(svg, /<rect [^>]*width="50"/);
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
