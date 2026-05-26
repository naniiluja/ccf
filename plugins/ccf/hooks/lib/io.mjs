// CCF hook I/O helpers — chạy trực tiếp bằng `node`, không build step, không dependency.
// Hợp đồng hook của Claude Code: nhận JSON qua stdin, trả JSON qua stdout / dùng exit code.

/**
 * Đọc toàn bộ stdin và parse JSON. Nếu rỗng hoặc lỗi → trả {} để hook không bao giờ crash.
 * @returns {Promise<Record<string, any>>}
 */
export async function readStdinJson() {
  return new Promise((resolve) => {
    let raw = "";
    // Nếu không có stdin (chạy tay không pipe), tránh treo: resolve {} khi stream đóng.
    if (process.stdin.isTTY) {
      resolve({});
      return;
    }
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      raw += chunk;
    });
    process.stdin.on("end", () => {
      const text = raw.trim();
      if (!text) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(text));
      } catch {
        resolve({});
      }
    });
    process.stdin.on("error", () => resolve({}));
  });
}

/**
 * Bơm context cho Claude qua additionalContext (được hỗ trợ ở SessionStart, PreToolUse,
 * PostToolUse, Stop...). In JSON ra stdout rồi exit 0.
 * @param {string} eventName tên hook event (vd "SessionStart", "Stop")
 * @param {string} text nội dung context cần bơm
 */
export function emitContext(eventName, text) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: eventName,
        additionalContext: text,
      },
    }),
  );
  process.exit(0);
}

/**
 * Chặn prompt ở UserPromptSubmit: ghi lý do ra stderr (Claude/người dùng thấy) rồi exit 2.
 * Exit code 2 = blocking error theo hợp đồng hook.
 * @param {string} reason lý do chặn
 */
export function blockUserPrompt(reason) {
  process.stderr.write(reason);
  process.exit(2);
}
