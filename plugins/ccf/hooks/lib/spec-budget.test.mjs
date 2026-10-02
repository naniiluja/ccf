import { test } from "node:test";
import assert from "node:assert/strict";
import { join, resolve } from "node:path";
import { parseImports, resolveImportTree, MAX_IMPORT_HOPS } from "./spec-budget.mjs";

const FENCE = "```";

const parseCases = [
  ["line-start relative import", "@a.md", ["a.md"]],
  ["import after whitespace mid-line", "see @b/c.md now", ["b/c.md"]],
  ["two imports on one line", "@a.md @b.md", ["a.md", "b.md"]],
  ["home-relative import", "@~/x.md", ["~/x.md"]],
  ["absolute import", "@/etc/x.md", ["/etc/x.md"]],
  ["escaped space", "@Design\\ Docs/a.md", ["Design Docs/a.md"]],
  ["double-quoted is skipped", '"@a.md"', []],
  ["inline code span is skipped", "use `@a.md` here", []],
  ["code span then real import", "`@x.md` and @y.md", ["y.md"]],
  ["backtick fenced block is skipped", `${FENCE}\n@a.md\n${FENCE}`, []],
  ["tilde fenced block is skipped", "~~~\n@a.md\n~~~", []],
  ["import after a closed fence counts", `${FENCE}md\n@a.md\n${FENCE}\n@b.md`, ["b.md"]],
  ["email is skipped", "mail a@b.com", []],
  ["bare at sign is skipped", "@ alone", []],
  ["empty text", "", []],
];

for (const [name, text, expected] of parseCases) {
  test(`parseImports: ${name}`, () => {
    assert.deepEqual(parseImports(text), expected);
  });
}

function fakeFs(files) {
  const map = new Map(Object.entries(files).map(([p, t]) => [resolve(p), t]));
  return (path) => {
    const text = map.get(resolve(path));
    if (text === undefined) throw new Error(`ENOENT ${path}`);
    return text;
  };
}

function chain(length) {
  const files = {};
  for (let i = 0; i <= length; i++) files[`/r/f${i}.md`] = i < length ? `@f${i + 1}.md` : "end";
  return files;
}

test("resolveImportTree: MAX_IMPORT_HOPS is four", () => {
  assert.equal(MAX_IMPORT_HOPS, 4);
});

test("resolveImportTree: zero hops counts only the root", () => {
  const tree = resolveImportTree("/r/f0.md", fakeFs({ "/r/f0.md": "no imports" }));
  assert.deepEqual(tree.files.map((f) => [f.path, f.depth]), [[resolve("/r/f0.md"), 0]]);
  assert.deepEqual(tree.missing, []);
});

test("resolveImportTree: four hops are all counted", () => {
  const tree = resolveImportTree("/r/f0.md", fakeFs(chain(4)));
  assert.deepEqual(tree.files.map((f) => f.depth), [0, 1, 2, 3, 4]);
});

test("resolveImportTree: the fifth hop is not counted", () => {
  const tree = resolveImportTree("/r/f0.md", fakeFs(chain(5)));
  assert.deepEqual(tree.files.map((f) => f.depth), [0, 1, 2, 3, 4]);
  assert.ok(!tree.files.some((f) => f.path === resolve("/r/f5.md")));
});

test("resolveImportTree: cycle A to B to A terminates and counts each once", () => {
  const tree = resolveImportTree("/r/a.md", fakeFs({ "/r/a.md": "@b.md", "/r/b.md": "@a.md" }));
  assert.deepEqual(tree.files.map((f) => f.path), [resolve("/r/a.md"), resolve("/r/b.md")]);
});

test("resolveImportTree: a file imported twice is counted once", () => {
  const tree = resolveImportTree(
    "/r/a.md",
    fakeFs({ "/r/a.md": "@b.md\n@c.md\n@b.md", "/r/b.md": "x", "/r/c.md": "@b.md" }),
  );
  assert.equal(tree.files.length, 3);
});

test("resolveImportTree: missing import is skipped with a warning entry", () => {
  const tree = resolveImportTree("/r/a.md", fakeFs({ "/r/a.md": "@gone.md\n@b.md", "/r/b.md": "x" }));
  assert.deepEqual(tree.files.map((f) => f.path), [resolve("/r/a.md"), resolve("/r/b.md")]);
  assert.deepEqual(tree.missing, [{ path: resolve("/r/gone.md"), from: resolve("/r/a.md") }]);
});

test("resolveImportTree: missing root yields no files and one missing entry", () => {
  const tree = resolveImportTree("/r/a.md", fakeFs({}));
  assert.deepEqual(tree.files, []);
  assert.deepEqual(tree.missing, [{ path: resolve("/r/a.md"), from: null }]);
});

test("resolveImportTree: resolves relative to the importing file", () => {
  const tree = resolveImportTree(
    "/r/a.md",
    fakeFs({ "/r/a.md": "@sub/x.md", "/r/sub/x.md": "@y.md", "/r/sub/y.md": "leaf", "/r/y.md": "wrong" }),
  );
  assert.deepEqual(tree.files.map((f) => f.path), [resolve("/r/a.md"), resolve("/r/sub/x.md"), resolve("/r/sub/y.md")]);
});

test("resolveImportTree: home-relative and absolute imports", () => {
  const tree = resolveImportTree(
    "/r/a.md",
    fakeFs({ "/r/a.md": "@~/h.md @/abs/z.md", "/home/u/h.md": "h", "/abs/z.md": "z" }),
    "/home/u",
  );
  assert.deepEqual(tree.files.map((f) => f.path), [resolve("/r/a.md"), join(resolve("/home/u"), "h.md"), resolve("/abs/z.md")]);
});

test("resolveImportTree: each file carries its text", () => {
  const tree = resolveImportTree("/r/a.md", fakeFs({ "/r/a.md": "@b.md", "/r/b.md": "body" }));
  assert.deepEqual(tree.files.map((f) => f.text), ["@b.md", "body"]);
});
