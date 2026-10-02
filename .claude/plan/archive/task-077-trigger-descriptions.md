# Task 077 — Trigger-style `description` for the 4 commands and 5 agents

- **Vertical slice:** the `description` line of every command and agent + one offline test that globs them all
- **Depends on:** —
- **Spec refs:** `.claude/rules/components.md` ("`description` is the field that DECIDES when Claude invokes the agent"; YAML `": "` trap); code.claude.com/docs/en/slash-commands; `.claude/rules/coding-conventions.md` (no comments in new code).
- **MCP to use:** none
- **discipline:** off
- **Gate:** `node --test .claude/tests/*.test.mjs` and `claude plugin validate plugins/ccf` (if the `claude` CLI is unavailable, say so in the report).

## Goal (one sentence)
Every command and agent `description` states WHEN to use it, and the two mutating commands (`cook`, `init`) say they run only on explicit request, because `ccf:cook` is in the model-invocable skill list and it merges and commits.

## Changes
- Rewrite ONLY the `description` frontmatter line of each file listed below; touch no other line.
- Keep every existing limit in agent descriptions ("Read-only", "does NOT fix code", "writes no files", etc.).
- `cook.md` and `init.md` include "only when the user explicitly asks".

## Acceptance criteria (verifiable)
- [ ] Every `description` under `plugins/ccf/commands/*.md` and `plugins/ccf/agents/*.md` matches `/^"?Use (only )?when/` and is at most 1,536 characters.
- [ ] `cook` and `init` contain "only when the user explicitly asks".
- [ ] Every agent keeps the word "Read-only" and its existing limits.
- [ ] No unquoted scalar contains `": "`.
- [ ] The test globs the directories (not a hardcoded list), so an agent added later (task 078) must follow too.

## Test first (write before implementing; confirm RED)
- `.claude/tests/descriptions.test.mjs`: `readdirSync` both directories, parse each frontmatter `description`, assert the criteria. No comments in the test.

## Files to touch
- `plugins/ccf/commands/check.md`
- `plugins/ccf/commands/cook.md`
- `plugins/ccf/commands/init.md`
- `plugins/ccf/commands/updatespec.md`
- `plugins/ccf/agents/ccf-best-practice-researcher.md`
- `plugins/ccf/agents/ccf-codebase-analyzer.md`
- `plugins/ccf/agents/ccf-scope-checker.md`
- `plugins/ccf/agents/ccf-spec-checker.md`
- `plugins/ccf/agents/ccf-spec-writer.md`
- `.claude/tests/descriptions.test.mjs` (new)
