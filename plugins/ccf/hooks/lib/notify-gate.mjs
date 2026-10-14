export const NOTIFY_TITLE = "CCF";
export const NOTIFY_COOLDOWN_MS = 60_000;

export function isLongTurnDone(isAborted = false, durationMs = 0, longTurnMs = 0) {
  return isAborted !== true && Number(durationMs) > longTurnMs;
}

export function isWaveSettled(agents = [{ taskId: "", isDone: false }], doneTaskId = "") {
  if (!doneTaskId || !Array.isArray(agents)) return false;
  return agents.some((agent) => agent.taskId === doneTaskId) && agents.every((agent) => agent.isDone);
}

export function isPastCooldown(lastAt = -Infinity, now = 0, cooldownMs = NOTIFY_COOLDOWN_MS) {
  return now - lastAt >= cooldownMs;
}

export function longTurnNotice(durationMs = 0, reason = "answer") {
  const seconds = Math.round(Number(durationMs) / 1000);
  return reason === "answer" ? `Rem làm xong rồi (${seconds}s)` : `Lượt chạy dừng vì trục trặc (${seconds}s)`;
}
