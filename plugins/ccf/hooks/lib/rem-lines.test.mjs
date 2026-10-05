import { test } from "node:test";
import assert from "node:assert/strict";
import { promptActivity, startLine, commandActivity, commandResult, testCounts, spawnedTaskId, runningLine, agentDoneLine, doneLine, DEFAULT_START_LINE, DEFAULT_DONE_LINE } from "./rem-lines.mjs";

const WAVES = [[{ id: "007", title: "login form", taskFile: "task-007-login.md", worktree: "ccf-it-007", branch: "worktree-ccf-it-007" }, { id: "008", title: "", taskFile: "task-008-x.md", worktree: "ccf-it-008", branch: "worktree-ccf-it-008" }]];

test("promptActivity: a CCF command gets a Vietnamese label, cook carries its task range; plain prose is null", () => {
  assert.deepEqual(promptActivity("/ccf:cook 007"), { command: "ccf:cook", label: "cook task 007" });
  assert.deepEqual(promptActivity("/ccf:cook"), { command: "ccf:cook", label: "cook backlog" });
  assert.equal(promptActivity("/ccf:check").label, "soát code theo spec");
  assert.equal(promptActivity("/ccf:updatespec").label, "cập nhật spec");
  assert.equal(promptActivity("/rem").label, "chạy /rem");
  assert.equal(promptActivity("sửa giúp Rem cái bug này"), null);
  assert.equal(promptActivity(undefined), null);
});

test("startLine: names the activity, falls back to the old line", () => {
  assert.equal(startLine(promptActivity("/ccf:cook 007")), "Rem đang cook task 007 đây.");
  assert.equal(startLine(null), DEFAULT_START_LINE);
});

test("commandActivity: test, CCF script, build and git each get their own line; anything else is null", () => {
  assert.deepEqual(commandActivity("node --test plugins/ccf/hooks/lib/*.test.mjs"), { kind: "test", what: "node --test", line: "Rem đang chạy test (node --test)." });
  assert.equal(commandActivity("npm run test").kind, "test");
  assert.equal(commandActivity("dotnet test").what, "dotnet test");
  assert.equal(commandActivity('node "/cache/ccf/scripts/plan-waves.mjs" --tasks 007').line, "Rem đang chia wave cho backlog.");
  assert.equal(commandActivity("node /x/integrate-wave.mjs --apply").line, "Rem đang merge wave và chạy test.");
  assert.equal(commandActivity("node /x/spec-budget.mjs").line, "Rem đang chạy spec-budget.mjs.");
  assert.equal(commandActivity("dotnet build -m:1").kind, "build");
  assert.equal(commandActivity("node node_modules/typescript/bin/tsc --noEmit").what, "tsc");
  assert.equal(commandActivity("git -C /repo commit -m x").line, "Rem đang chạy git commit.");
  assert.equal(commandActivity("ls -la"), null);
  assert.equal(commandActivity(undefined), null);
});

test("testCounts: reads both '30 pass' and 'ℹ pass 527' styles", () => {
  assert.equal(testCounts(" 30 pass\n 0 fail\n"), "30 pass, 0 fail");
  assert.equal(testCounts("ℹ pass 527\nℹ fail 0"), "527 pass, 0 fail");
  assert.equal(testCounts("Build succeeded."), "");
});

test("commandResult: green test → happy with counts, red → worried, script ok:false → worried, git ok → keeps thinking", () => {
  const green = commandResult(commandActivity("node --test a.test.mjs"), false, "ℹ pass 12\nℹ fail 0");
  assert.deepEqual(green, { failed: false, mood: "happy", outcome: "node --test xanh (12 pass, 0 fail)", line: "node --test xanh rồi (12 pass, 0 fail)! Rem mừng lắm." });
  const red = commandResult(commandActivity("npm test"), false, "Tests: 3 failed, 9 passed");
  assert.equal(red.mood, "worried");
  assert.equal(red.line, "npm test lỗi rồi (9 pass, 3 fail). Để Rem xem lại.");
  assert.equal(commandResult(commandActivity("dotnet build"), true, "").line, "dotnet build lỗi rồi. Để Rem xem lại.");
  assert.equal(commandResult(commandActivity("node /x/integrate-wave.mjs --apply"), false, '{"ok": false}').mood, "worried");
  assert.equal(commandResult(commandActivity("node /x/worktree-preflight.mjs"), false, '{"ok": true, "ready": false}').failed, true);
  assert.deepEqual(commandResult(commandActivity("git commit -m x"), false, "1 file changed"), { failed: false, mood: "thinking", outcome: "git commit xong", line: "git commit xong rồi, Rem làm tiếp nhé." });
});

test("spawnedTaskId: the wave map match first, then a cook brief's task file; other spawns are null", () => {
  assert.equal(spawnedTaskId(WAVES, "Implement .claude/plan/task-007-login.md"), "007");
  assert.equal(spawnedTaskId([], "Branch: `worktree-ccf-it-012`, task file `.claude/plan/task-012-x.md`"), "012");
  assert.equal(spawnedTaskId([], "Analyze the hooks slice"), null);
});

test("runningLine / agentDoneLine: name the running tasks with their titles, and what is left after one finishes", () => {
  const agents = [{ agentId: "a", taskId: "007", isDone: false }, { agentId: "b", taskId: "008", isDone: false }];
  assert.equal(runningLine(WAVES, agents), "Rem đang cook task 007 (login form), 008.");
  assert.equal(runningLine(WAVES, []), null);
  assert.equal(agentDoneLine(WAVES, agents, "007"), "Task 007 (login form) xong rồi, còn 008 đang chạy.");
  assert.equal(agentDoneLine(WAVES, [{ ...agents[0], isDone: true }], "007"), "Task 007 (login form) xong rồi, cả wave đã báo về.");
  assert.equal(agentDoneLine(WAVES, agents, ""), null);
});

test("doneLine: activity and last result when known, the old line otherwise", () => {
  assert.equal(doneLine(promptActivity("/ccf:cook 007"), "npm test xanh (12 pass)"), "Rem cook task 007 xong: npm test xanh (12 pass). Bạn xem thử nhé.");
  assert.equal(doneLine(undefined, "tsc xanh"), "Xong rồi: tsc xanh. Bạn xem thử nhé.");
  assert.equal(doneLine(promptActivity("/ccf:check"), ""), "Rem soát code theo spec xong rồi, bạn xem thử nhé.");
  assert.equal(doneLine(undefined, ""), DEFAULT_DONE_LINE);
});
