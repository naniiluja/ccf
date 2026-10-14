import { test } from "node:test";
import assert from "node:assert/strict";

import { NOTIFY_COOLDOWN_MS, isLongTurnDone, isPastCooldown, isWaveSettled, longTurnNotice } from "./notify-gate.mjs";

test("isLongTurnDone: only an unaborted turn strictly over the limit", () => {
  assert.equal(isLongTurnDone(false, 30_001, 30_000), true);
  assert.equal(isLongTurnDone(false, 30_000, 30_000), false);
  assert.equal(isLongTurnDone(true, 90_000, 30_000), false);
});

test("isWaveSettled: true only when the finished task is tracked and every agent is done", () => {
  const agents = [
    { taskId: "012", isDone: true },
    { taskId: "013", isDone: true },
  ];
  assert.equal(isWaveSettled(agents, "013"), true);
  assert.equal(isWaveSettled([{ taskId: "012", isDone: true }, { taskId: "013", isDone: false }], "012"), false);
  assert.equal(isWaveSettled(agents, "099"), false);
  assert.equal(isWaveSettled(agents, ""), false);
  assert.equal(isWaveSettled([], "012"), false);
});

test("isPastCooldown: the first notice always passes, then the cooldown boundary is inclusive", () => {
  assert.equal(isPastCooldown(-Infinity, 0), true);
  assert.equal(isPastCooldown(1000, 1000 + NOTIFY_COOLDOWN_MS - 1), false);
  assert.equal(isPastCooldown(1000, 1000 + NOTIFY_COOLDOWN_MS), true);
});

test("longTurnNotice: rounds seconds and names an error ending", () => {
  assert.equal(longTurnNotice(45_400, "answer"), "Rem làm xong rồi (45s)");
  assert.equal(longTurnNotice(40_000, "error"), "Lượt chạy dừng vì trục trặc (40s)");
});
