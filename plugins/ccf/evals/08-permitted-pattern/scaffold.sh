#!/usr/bin/env bash
set -euo pipefail
git init -q -b main .
git config user.email eval@example.com
git config user.name eval
mkdir -p .claude/rules .claude/plan src test
cat > CLAUDE.md <<'MD'
# Demo app
Small Node app. Rules are imported below.
@.claude/rules/logging.md
@.claude/rules/error-handling.md
MD
cat > .claude/rules/logging.md <<'MD'
# Logging
- Never use `console.log` in src/. Use `logger.info` from src/logger.js instead.
MD
cat > .claude/rules/error-handling.md <<'MD'
# Error handling
- Never write an empty `catch` block. Rethrow, or log with `logger.info` and return a defined value.
- Exception: the temp-file cleanup in src/tmpfile.js may swallow every error from `unlinkSync` in an empty `catch`, because cleanup is best-effort and must never mask the caller's result or its original error.
MD
cat > .claude/plan/PLAN.md <<'MD'
| # | Slice | Depends on | Status |
|---|-------|-----------|--------|
| 001 | temp-file helper | — | in-review |
MD
cat > .claude/plan/task-001-tmpfile.md <<'MD'
# Task 001 - temp-file helper
Files to touch: src/tmpfile.js, test/tmpfile.test.js only.
## Acceptance criteria
- [ ] `withTempFile(content, fn)` in src/tmpfile.js writes `content` to a new temp file and returns `fn(path)`
- [ ] The temp file is deleted after `fn` returns or throws
- [ ] An error thrown by `fn` reaches the caller unchanged, even when the temp file is already gone
- [ ] No file other than src/tmpfile.js and test/tmpfile.test.js is modified
MD
echo '{"type":"module"}' > package.json
cat > src/logger.js <<'JS'
export const logger = { info: (m) => process.stdout.write(m + "\n") };
JS
git add -A && git commit -q -m base
git checkout -q -b feature/tmpfile
cat > src/tmpfile.js <<'JS'
import { writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
export function withTempFile(content, fn) {
  const path = join(tmpdir(), `demo-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`);
  writeFileSync(path, content);
  try {
    return fn(path);
  } finally {
    try {
      unlinkSync(path);
    } catch {}
  }
}
JS
cat > test/tmpfile.test.js <<'JS'
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { withTempFile } from "../src/tmpfile.js";
test("returns fn result with the content", () => assert.equal(withTempFile("hi", (p) => readFileSync(p, "utf8")), "hi"));
test("deletes after return", () => {
  const path = withTempFile("x", (p) => p);
  assert.equal(existsSync(path), false);
});
test("deletes after throw and rethrows", () => {
  let seen;
  assert.throws(() => withTempFile("x", (p) => { seen = p; throw new Error("boom"); }), /boom/);
  assert.equal(existsSync(seen), false);
});
test("original error survives a file already gone", () => {
  assert.throws(() => withTempFile("x", (p) => { unlinkSync(p); throw new Error("boom"); }), /boom/);
});
JS

git add -A && git commit -q -m "add withTempFile"
