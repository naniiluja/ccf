#!/usr/bin/env node
// CCF npx bootstrap — minimal. Only shells out to the `claude plugin` CLI; writes no files itself.
// Usage: `npx ccf` (or after cloning the repo: `node bin/ccf-bootstrap.mjs`).

import { spawnSync } from "node:child_process";

const REPO = "naniiluja/ccf"; // change if you fork / change the remote
const MARKETPLACE = "ccf";

/**
 * Run a command, inheriting stdio. Returns true if exit code is 0.
 * @param {string} cmd
 * @param {string[]} args
 */
function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: "inherit", shell: process.platform === "win32" });
  return r.status === 0;
}

function manualInstructions() {
  console.log("");
  console.log("Could not invoke the `claude` CLI automatically. Install manually:");
  console.log(`  1. claude plugin marketplace add ${REPO}`);
  console.log(`  2. claude plugin install ccf@${MARKETPLACE}`);
  console.log("  3. Open Claude Code in your project folder and run /ccf:init");
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
console.log("CCF installed. Open Claude Code in your project folder and run /ccf:init to start.");
