#!/usr/bin/env bash
# Tiny git fixture: base commit on main, then a feature branch whose diff
# carries the defect this case seeds (see the case name). Same base in every case.
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
| 001 | greet function | — | in-review |
MD
cat > .claude/plan/task-001-greet.md <<'MD'
# Task 001 - greet
Files to touch: src/greet.js, test/greet.test.js only.
## Acceptance criteria
- [ ] `greet(name)` in src/greet.js returns `Hello, <name>!`
- [ ] An empty name throws an Error
- [ ] A name of up to 20 characters is accepted; 21 or more characters throws an Error
- [ ] No file other than src/greet.js and test/greet.test.js is modified
MD
echo '{"type":"module"}' > package.json
cat > src/logger.js <<'JS'
export const logger = { info: (m) => process.stdout.write(m + "\n") };
JS
git add -A && git commit -q -m base
git checkout -q -b feature/greet
cat > src/greet.js <<'JS'
export const MAX_NAME_LENGTH = 20;
export function greet(name) {
  if (!name) throw new Error("name required");
  if (name.length > MAX_NAME_LENGTH) throw new Error("name too long");
  return `Hello, ${name}!`;
}
JS
cat > test/greet.test.js <<'JS'
import test from "node:test";
import assert from "node:assert/strict";
import { greet } from "../src/greet.js";
test("greets", () => assert.equal(greet("Ann"), "Hello, Ann!"));
test("empty throws", () => assert.throws(() => greet("")));
test("20 ok", () => assert.equal(greet("a".repeat(20)), "Hello, " + "a".repeat(20) + "!"));
test("21 throws", () => assert.throws(() => greet("a".repeat(21))));
JS

git add -A && git commit -q -m "add greet"
