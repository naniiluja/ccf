import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";

export const MAX_IMPORT_HOPS = 4;

const FENCE_RE = /^ {0,3}(`{3,}|~{3,})/;
const CODE_SPAN_RE = /(`+)[\s\S]*?\1/g;
const IMPORT_RE = /(?:^|\s)@((?:\\ |[^\s"])+)/g;

export function parseImports(text = "") {
  const imports = [];
  let openFence = "";
  for (const line of String(text).split(/\r?\n/)) {
    const fence = line.match(FENCE_RE);
    if (openFence) {
      if (fence && fence[1][0] === openFence[0] && fence[1].length >= openFence.length) openFence = "";
      continue;
    }
    if (fence) {
      openFence = fence[1];
      continue;
    }
    for (const match of line.replace(CODE_SPAN_RE, "").matchAll(IMPORT_RE)) {
      imports.push(match[1].replace(/\\ /g, " "));
    }
  }
  return imports;
}

function resolveImportPath(importPath = "", importer = "", home = "") {
  if (importPath.startsWith("~/")) return join(resolve(home), importPath.slice(2));
  if (isAbsolute(importPath)) return resolve(importPath);
  return resolve(dirname(importer), importPath);
}

function importerOf(path = "") {
  return path || null;
}

function readText(path = "") {
  return readFileSync(path, "utf8");
}

export function resolveImportTree(rootFile = "", readFile = readText, home = homedir()) {
  const files = [];
  const missing = [];
  const seen = new Set();
  const queue = [{ path: resolve(rootFile), depth: 0, from: importerOf("") }];
  while (queue.length > 0) {
    const next = queue.shift();
    if (!next || seen.has(next.path)) continue;
    seen.add(next.path);
    let text;
    try {
      text = String(readFile(next.path));
    } catch {
      missing.push({ path: next.path, from: next.from });
      continue;
    }
    files.push({ path: next.path, depth: next.depth, text });
    if (next.depth >= MAX_IMPORT_HOPS) continue;
    for (const importPath of parseImports(text)) {
      queue.push({ path: resolveImportPath(importPath, next.path, home), depth: next.depth + 1, from: importerOf(next.path) });
    }
  }
  return { files, missing };
}
