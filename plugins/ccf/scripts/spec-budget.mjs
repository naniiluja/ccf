#!/usr/bin/env node
import { join, relative, resolve } from "node:path";
import { resolveImportTree } from "../hooks/lib/spec-budget.mjs";

const CLAUDE_MD_MAX_LINES = 200;
const CLAUDE_MD_MAX_BYTES = 12 * 1024;

function readDir(argv = [""]) {
  const i = argv.indexOf("--dir");
  if (i >= 0 && i + 1 < argv.length) return argv[i + 1];
  return process.env.CLAUDE_PROJECT_DIR || process.cwd();
}

function countLines(text = "") {
  return (text.match(/\n/g) || []).length;
}

function main() {
  const dir = resolve(readDir(process.argv.slice(2)));
  const rootFile = join(dir, "CLAUDE.md");
  const tree = resolveImportTree(rootFile);
  const files = tree.files.map((f) => ({
    path: relative(dir, f.path) || f.path,
    bytes: Buffer.byteLength(f.text, "utf8"),
    lines: countLines(f.text),
    depth: f.depth,
  }));
  const claudeMd = files.find((f) => f.depth === 0);
  const claudeMdOver = claudeMd
    ? claudeMd.lines >= CLAUDE_MD_MAX_LINES || claudeMd.bytes >= CLAUDE_MD_MAX_BYTES
    : false;
  const result = {
    dir,
    files,
    total: files.reduce((sum, f) => sum + f.bytes, 0),
    claudeMdOver,
    limits: { lines: CLAUDE_MD_MAX_LINES, bytes: CLAUDE_MD_MAX_BYTES },
    missing: tree.missing.map((m) => ({
      path: relative(dir, m.path) || m.path,
      from: m.from === null ? null : relative(dir, m.from) || m.from,
    })),
  };
  console.log(JSON.stringify(result, null, 2));
}

try {
  main();
} catch (error) {
  console.log(JSON.stringify({ error: String(error instanceof Error ? error.message : error) }));
}
process.exit(0);
