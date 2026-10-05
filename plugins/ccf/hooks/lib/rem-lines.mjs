import { isCookTaskBrief, matchWaveTask } from "./ui-model.mjs";

export const GREETING = { mood: "idle", line: "Rem đây. Bạn cần gì cứ gọi nhé." };
export const DEFAULT_START_LINE = "Để Rem lo việc này.";
export const DEFAULT_DONE_LINE = "Xong rồi, bạn xem thử nhé.";

const NO_WAVE_TASK = { id: "", title: "", taskFile: "", worktree: "", branch: "" };
const NO_AGENT = { agentId: "", taskId: "", isDone: false };

const PROMPT_LABELS = new Map([
  ["ccf:cook", "cook"],
  ["ccf:check", "soát code theo spec"],
  ["ccf:plan", "lên kế hoạch"],
  ["ccf:updatespec", "cập nhật spec"],
  ["ccf:init", "dựng spec cho dự án"],
]);

const TEST = /\b(node\s+--test|claude\s+plugin\s+test|(npm|pnpm|yarn|bun)\s+(run\s+)?test|npx\s+(vitest|jest)|vitest|jest|pytest|cargo\s+test|go\s+test|dotnet\s+test|mvn\s+test|gradlew?\s+test)\b/i;
const BUILD = /\b(dotnet\s+(build|run|publish)|msbuild|(npm|pnpm|yarn)\s+(run\s+)?build|tsc|mvn|gradlew?|cargo\s+build|go\s+build|claude\s+plugin\s+validate)\b/i;
const CCF_SCRIPT = /\b([\w-]+)\.mjs\b/;
const GIT = /\bgit\s+(?:-[Cc]\s+\S+\s+)*([a-z][\w-]*)/;
const SCRIPT_LINES = new Map([
  ["plan-waves", "Rem đang chia wave cho backlog."],
  ["worktree-preflight", "Rem đang soát wave trước khi merge."],
  ["integrate-wave", "Rem đang merge wave và chạy test."],
]);
const FAILED = /Build FAILED|: error [A-Z]+\d+|Failed!|npm ERR!|\b[1-9]\d* (failed|errors?)\b|^ℹ fail [1-9]/im;
const PASS_COUNT = /\b(\d+) pass(?:ed|ing)?\b|\bpass (\d+)\b/i;
const FAIL_COUNT = /\b(\d+) fail(?:ed|ing|s)?\b|\bfail (\d+)\b/i;

export function promptActivity(text = "") {
  const found = String(text ?? "").trim().match(/^\/([\w:-]+)(?:\s+(.*))?$/s);
  if (!found) return null;
  const command = found[1];
  const args = String(found[2] ?? "").trim().split(/\s+/)[0] ?? "";
  const label = PROMPT_LABELS.get(command);
  if (command === "ccf:cook") return { command, label: args ? `cook task ${args}` : "cook backlog" };
  return { command, label: label ?? `chạy /${command}` };
}

export function startLine(activity = { command: "", label: "" }) {
  return activity ? `Rem đang ${activity.label} đây.` : DEFAULT_START_LINE;
}

export function commandActivity(command = "") {
  const text = String(command ?? "");
  const test = text.match(TEST);
  if (test) return { kind: "test", what: test[0], line: `Rem đang chạy test (${test[0]}).` };
  const script = text.match(CCF_SCRIPT);
  if (script && /\bnode\b/.test(text)) {
    const name = script[1];
    return { kind: "script", what: `${name}.mjs`, line: SCRIPT_LINES.get(name) ?? `Rem đang chạy ${name}.mjs.` };
  }
  const build = text.match(BUILD);
  if (build) return { kind: "build", what: build[0], line: `Rem đang build (${build[0]}).` };
  const git = text.match(GIT);
  if (git) return { kind: "git", what: `git ${git[1]}`, line: `Rem đang chạy git ${git[1]}.` };
  return null;
}

export function testCounts(output = "") {
  const text = String(output ?? "");
  const passFound = text.match(PASS_COUNT);
  const failFound = text.match(FAIL_COUNT);
  const pass = passFound ? passFound[1] ?? passFound[2] : undefined;
  const fail = failFound ? failFound[1] ?? failFound[2] : undefined;
  const parts = [pass === undefined ? "" : `${pass} pass`, fail === undefined ? "" : `${fail} fail`].filter(Boolean);
  return parts.join(", ");
}

function scriptFailed(output = "") {
  const start = output.indexOf("{");
  const end = output.lastIndexOf("}");
  if (start < 0 || end < start) return false;
  try {
    const json = JSON.parse(output.slice(start, end + 1));
    return json?.ok === false || json?.ready === false;
  } catch {
    return false;
  }
}

export function commandResult(activity = { kind: "", what: "", line: "" }, isError = false, output = "") {
  const text = String(output ?? "");
  const failed = isError === true || FAILED.test(text) || (activity.kind === "script" && scriptFailed(text));
  const counts = activity.kind === "test" || activity.kind === "build" ? testCounts(text) : "";
  const detail = counts ? ` (${counts})` : "";
  if (failed) return { failed, mood: "worried", outcome: `${activity.what} lỗi${detail}`, line: `${activity.what} lỗi rồi${detail}. Để Rem xem lại.` };
  if (activity.kind === "test" || activity.kind === "build") return { failed, mood: "happy", outcome: `${activity.what} xanh${detail}`, line: `${activity.what} xanh rồi${detail}! Rem mừng lắm.` };
  return { failed, mood: "thinking", outcome: `${activity.what} xong`, line: `${activity.what} xong rồi, Rem làm tiếp nhé.` };
}

export function spawnedTaskId(waves = [[NO_WAVE_TASK]], brief = "") {
  const text = String(brief ?? "");
  const matched = matchWaveTask(Array.isArray(waves) ? waves : [], text);
  if (matched) return matched;
  if (!isCookTaskBrief(text)) return null;
  return text.match(/\btask-([A-Za-z0-9]+)-/)?.[1] ?? null;
}

function taskName(waves = [[NO_WAVE_TASK]], id = "") {
  const title = waves.flat().find((task) => task.id === id)?.title;
  return title ? `${id} (${title})` : id;
}

export function runningLine(waves = [[NO_WAVE_TASK]], agents = [NO_AGENT], extraIds = [""]) {
  const list = Array.isArray(waves) ? waves : [];
  const ids = [...new Set([...(Array.isArray(agents) ? agents : []).filter((agent) => !agent.isDone).map((agent) => agent.taskId), ...(Array.isArray(extraIds) ? extraIds : [])].filter(Boolean))];
  if (ids.length === 0) return null;
  return `Rem đang cook task ${ids.map((id) => taskName(list, id)).join(", ")}.`;
}

export function agentDoneLine(waves = [[NO_WAVE_TASK]], agents = [NO_AGENT], doneTaskId = "") {
  if (!doneTaskId) return null;
  const list = Array.isArray(waves) ? waves : [];
  const rest = [...new Set((Array.isArray(agents) ? agents : []).filter((agent) => !agent.isDone && agent.taskId !== doneTaskId).map((agent) => agent.taskId).filter(Boolean))];
  const head = `Task ${taskName(list, doneTaskId)} xong rồi`;
  return rest.length > 0 ? `${head}, còn ${rest.join(", ")} đang chạy.` : `${head}, cả wave đã báo về.`;
}

export function doneLine(activity = { command: "", label: "" }, outcome = "") {
  const label = activity?.label ?? "";
  if (label && outcome) return `Rem ${label} xong: ${outcome}. Bạn xem thử nhé.`;
  if (outcome) return `Xong rồi: ${outcome}. Bạn xem thử nhé.`;
  if (label) return `Rem ${label} xong rồi, bạn xem thử nhé.`;
  return DEFAULT_DONE_LINE;
}

export const VOICE_MODEL = "claude-haiku-4-5";
export const VOICE_DEBOUNCE_MS = 600;
export const VOICE_TIMEOUT_MS = 8000;
const VOICE_MAX_TOKENS = 120;
const VOICE_MAX_CHARS = 120;
const VOICE_CACHE_LIMIT = 100;
const VOICE_SYSTEM = [
  "Bạn là Rem, linh vật nhỏ của plugin CCF đứng cạnh ô chat trong Claude Code.",
  "Rem nói tiếng Việt, xưng Rem, gọi người dùng là bạn, giọng tự nhiên và dễ thương, hợp với tâm trạng được cho.",
  "Viết lại câu gốc thành đúng MỘT câu ngắn, tối đa 100 ký tự.",
  "Giữ nguyên mọi sự kiện trong câu gốc: mã task, lệnh bắt đầu bằng /, tên file, mọi con số. Không thêm thông tin mới.",
  "Không emoji, không markdown, không ngoặc kép. Chỉ trả về câu thoại.",
].join("\n");
const FACT = /\/[\w:-]+|[\w.-]+\.(?:mjs|md|tsx?|jsx?|json)\b|\d+/g;
const QUOTES = /^["'“”‘’«»]+|["'“”‘’«»]+$/g;

export function isVoiceOn(options = { remAi: true }) {
  return options?.remAi !== false;
}

export function voiceRequest(mood = "idle", line = "") {
  return { model: VOICE_MODEL, system: VOICE_SYSTEM, prompt: `Tâm trạng: ${mood}\nCâu gốc: ${line}`, maxTokens: VOICE_MAX_TOKENS, timeoutMs: VOICE_TIMEOUT_MS };
}

export function voiceReply(text = "", line = "") {
  const first = String(text ?? "").split(/\r?\n/).map((part) => part.trim()).find(Boolean) ?? "";
  const said = first.replace(QUOTES, "").replace(/\s+/g, " ").trim();
  if (!said || [...said].length > VOICE_MAX_CHARS) return null;
  const facts = String(line ?? "").match(FACT) ?? [];
  return facts.every((fact) => said.includes(fact)) ? said : null;
}

export function createVoice(limit = VOICE_CACHE_LIMIT) {
  const rewrites = new Map();
  let latest = 0;
  const keyOf = (mood = "", line = "") => `${mood}\n${line}`;
  return {
    cached: (mood = "", line = "") => rewrites.get(keyOf(mood, line)) ?? null,
    remember: (mood = "", line = "", said = "") => {
      rewrites.delete(keyOf(mood, line));
      rewrites.set(keyOf(mood, line), said);
      if (rewrites.size > limit) rewrites.delete(rewrites.keys().next().value);
    },
    begin: () => ++latest,
    isCurrent: (id = 0) => id === latest,
  };
}

export const remVoice = createVoice();
