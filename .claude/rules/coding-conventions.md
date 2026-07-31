---
description: JS/Node and markdown conventions for the CCF plugin project.
---

# Coding conventions

## JavaScript / Node (`*.mjs`)
- **Pure ESM**: `import ... from "node:..."`. Always prefix `node:` for built-in modules.
- **JSDoc required** for every exported function and every function with parameters: `@param`/`@returns` with types — because `tsconfig.json` enables `checkJs` + `strict`, wrong types fail `tsc` (see how to run `tsc` with the `@types/node` prerequisite in `testing.md`).
- Small pure functions, one responsibility. Shared helpers (e.g. hook I/O) live in `hooks/lib/` and are imported — DRY, don't copy-paste the stdin/stdout contract.
- Use meaningful names (`findActiveTask`, `specsOlderThanCode`); no cryptic abbreviations.
- Comments explain **why** (e.g. "avoid hanging when there is no stdin"), not what the code already says.
- Coerce untrusted input: `String(input.x ?? "")`, `Number(...)` — don't trust stdin data.

## Markdown (command / agent / rule / template)
- Valid YAML frontmatter, with the correct fields per type (see `components.md`).
- Clear heading hierarchy; commands/agents use numbered step headings.
- Instructions to Claude are written in the imperative, decisively. Prefer the affirmative form with its reason: "Spawn `ccf-codebase-analyzer` for discovery, because CCF does not own the built-in `Explore` agent's prompt" carries the same force as a bare prohibition and also tells the model what to do instead. A prohibition is still correct when there is no substitute action, but it never stands alone without a reason.
- Keep it concise, each sentence adds new information — this is context Claude must load, longer = more tokens + dilution.
- Prompts under `plugins/ccf/{commands,agents,skills}/` also follow `.claude/rules/prompt-standard.md`, which owns their prose (checklist, style block, codepoint policy, review markers). It is `paths:`-scoped, so read it by path if you are editing a prompt from elsewhere.

## Language
- All prose (comments, prompts, rules) in **English**. Keep technical identifiers (tool names, fields, commands) in their original form.
- **Terminology, in text generated FOR a user in another language** (the repo's own source is unaffected): translate a concept when that language has a natural equivalent, and keep a difficult or ambiguous English term verbatim with a short parenthetical explanation on its first use. Forcing a translation onto a term with no settled equivalent (fail-open, premortem, drift) produces a word the user has to translate back to understand.

## Design principles (apply to every change)
- **KISS**: pick the simplest thing that works; hooks prefer lightweight heuristics over heavy analysis.
- **YAGNI**: only add a rule/command/field when there's a real need. Don't generate empty rules for things that don't apply (e.g. this project has NO data-layer/api/component rule).
- **DRY**: the hook contract lives in one place (`io.mjs`); conventions in `.claude/rules/`, not repeated in every prompt.
- **SRP**: one file, one responsibility.
