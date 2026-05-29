# Usage hint — `settings.json.tmpl`

> JSON forbids comments, so the fill instructions for `settings.json.tmpl` live here (not inside the JSON). This file is a template artifact for `/ccf-init`; do NOT copy it into the target project.

`.claude/settings.json` is **harness-level** config (per `code.claude.com/docs/en/settings`): Claude Code enforces it deterministically, so it supersedes any narrative rule in `CLAUDE.md`/`git-workflow.md`.

## Placeholders
Both are **strings** under the `attribution` object — the trailer text Claude Code appends. An empty string `""` suppresses the trailer (deterministic; replaces the deprecated `includeCoAuthoredBy`).

- `{{ATTRIBUTION_COMMIT}}` — commit-message attribution trailer.
  - Repo history shows Co-Authored-By/Generated-with trailers → keep them: e.g. `"Co-Authored-By: Claude <noreply@anthropic.com>"`.
  - Repo history has NO such trailer (clean subjects only) → use `""` to suppress it.
- `{{ATTRIBUTION_PR}}` — PR-body attribution trailer; same rule. Use `""` if the repo's PRs carry no Claude attribution.

## How `/ccf-init` fills it
Infer the value from the **repo's actual git history** (same slice-5 `git log` inference used for `git-workflow.md`'s `{{COMMIT_CONVENTION}}`) — do NOT invent. If history is thin (≤2 commits) or inconsistent, state what you observed, propose a value, and have the user confirm before writing. Result must be valid JSON (no comments, no trailing commas).
