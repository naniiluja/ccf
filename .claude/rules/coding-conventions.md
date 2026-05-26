---
description: JS/Node and markdown conventions for the CCF plugin project.
---

# Coding conventions

## JavaScript / Node (`*.mjs`)
- **Pure ESM**: `import ... from "node:..."`. Always prefix `node:` for built-in modules.
- **JSDoc required** for every exported function and every function with parameters: `@param`/`@returns` with types — because `tsconfig.json` enables `checkJs` + `strict`, wrong types fail `tsc` (see how to run `tsc` with the `@types/node` prerequisite in `testing.md`).
- Small pure functions, one responsibility. Shared helpers (e.g. hook I/O) live in `hooks/lib/` and are imported — DRY, don't copy-paste the stdin/stdout contract.
- Use meaningful names (`findInProgressTask`, `specsOlderThanCode`); no cryptic abbreviations.
- Comments explain **why** (e.g. "avoid hanging when there is no stdin"), not what the code already says.
- Coerce untrusted input: `String(input.x ?? "")`, `Number(...)` — don't trust stdin data.

## Markdown (command / agent / rule / template)
- Valid YAML frontmatter, with the correct fields per type (see `components.md`).
- Clear heading hierarchy; commands/agents use numbered step headings.
- Instructions to Claude are written in the imperative, decisively (e.g. "STOP.", "Do NOT commit").
- Keep it concise, each sentence adds new information — this is context Claude must load, longer = more tokens + dilution.

## Language
- All prose (comments, prompts, rules) in **English**. Keep technical identifiers (tool names, fields, commands) in their original form.

## Design principles (apply to every change)
- **KISS**: pick the simplest thing that works; hooks prefer lightweight heuristics over heavy analysis.
- **YAGNI**: only add a rule/command/field when there's a real need. Don't generate empty rules for things that don't apply (e.g. this project has NO data-layer/api/component rule).
- **DRY**: the hook contract lives in one place (`io.mjs`); conventions in `.claude/rules/`, not repeated in every prompt.
- **SRP**: one file, one responsibility.
