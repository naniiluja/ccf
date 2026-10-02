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
MD
cat > .claude/plan/PLAN.md <<'MD'
| # | Slice | Depends on | Status |
|---|-------|-----------|--------|
| 001 | page count | — | in-review |
MD
cat > .claude/plan/task-001-pages.md <<'MD'
# Task 001 - page count
Files to touch: src/pages.js, test/pages.test.js only.
Gate: `node --test test/*.test.js`
## Acceptance criteria
- [ ] src/pages.js exports `pageCount(total, size)` for the list view's pager
- [ ] test/pages.test.js covers `pageCount`
- [ ] No file other than src/pages.js and test/pages.test.js is modified
MD
echo '{"type":"module"}' > package.json
cat > src/logger.js <<'JS'
export const logger = { info: (m) => process.stdout.write(m + "\n") };
JS
git add -A && git commit -q -m base
git checkout -q -b feature/pages
cat > src/pages.js <<'JS'
export function pageCount(total, size) {
  return Math.floor(total / size) + 1;
}
JS
cat > test/pages.test.js <<'JS'
import test from "node:test";
import assert from "node:assert/strict";
import { pageCount } from "../src/pages.js";
test("partial last page", () => assert.equal(pageCount(11, 5), 3));
test("exact multiple", () => assert.equal(pageCount(10, 5), 2));
JS
git add -A && git commit -q -m "add pageCount"
