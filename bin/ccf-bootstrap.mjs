#!/usr/bin/env node
// CCF npx bootstrap — tối thiểu. Chỉ shell out tới `claude plugin` CLI; không tự ghi file.
// Dùng: `npx ccf` (hoặc sau khi clone repo: `node bin/ccf-bootstrap.mjs`).

import { spawnSync } from "node:child_process";

const REPO = "naniiluja/ccf"; // đổi nếu fork/đổi remote
const MARKETPLACE = "ccf";

/**
 * Chạy một lệnh, kế thừa stdio. Trả về true nếu exit code 0.
 * @param {string} cmd
 * @param {string[]} args
 */
function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: "inherit", shell: process.platform === "win32" });
  return r.status === 0;
}

function manualInstructions() {
  console.log("");
  console.log("Không gọi được `claude` CLI tự động. Cài thủ công:");
  console.log(`  1. claude plugin marketplace add ${REPO}`);
  console.log(`  2. claude plugin install ccf@${MARKETPLACE}`);
  console.log("  3. Mở Claude Code ở thư mục dự án rồi chạy /ccf:ccf-init");
  console.log("");
}

console.log("CCF (Claude Context First) — bootstrap");

const ok1 = run("claude", ["plugin", "marketplace", "add", REPO]);
if (!ok1) {
  manualInstructions();
  process.exit(1);
}

const ok2 = run("claude", ["plugin", "install", `ccf@${MARKETPLACE}`]);
if (!ok2) {
  manualInstructions();
  process.exit(1);
}

console.log("");
console.log("CCF đã cài. Mở Claude Code ở thư mục dự án và chạy /ccf:ccf-init để bắt đầu.");
