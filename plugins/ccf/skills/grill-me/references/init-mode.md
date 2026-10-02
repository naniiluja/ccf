# grill-me — `init` mode decision tree

Walk this decision tree to elicit project decisions. Recommend an answer for each, and prefer confirming what the repo plus `git log` / `git branch` already reveal over asking blind:
- (a) What system + the core problem?
- (b) Acceptable budget/cost?
- (c) App type: REST API / frontend / backend / fullstack?
- (d) Expected user scale? Based on scale, propose hosting (e.g. Supabase or Railway) and tell the user to install the corresponding MCP (`/plugin install ...`).
- (e) Design patterns for FE & BE? **If there is a frontend, recommend React + Tailwind CSS + shadcn/ui by default** (stable, mainstream, well-supported, and it has an MCP that lets Claude browse/install components) with a one-line rationale; the user is free to choose otherwise. When chosen, tell the user that `/ccf:init` will add the shadcn MCP to THIS project's `.mcp.json` (`{"command":"npx","args":["shadcn@latest","mcp"]}`); after `shadcn init` creates `components.json` they restart Claude Code and run `/mcp` to confirm it shows `Connected`.
- (e2) **Design source (only if there is a frontend):** ask whether the user has a Claude Design handoff bundle (a URL like `https://api.anthropic.com/v1/design/h/...`). If yes, record the URL so the FE spec can follow it as the visual source of truth. If no, suggest creating one in Claude Design for a more polished UI (it exports HTML/React plus a design spec to hand to Claude Code), and default to none if they decline. Do not fetch the URL, which is authenticated.
- (f) AI-traceable logging system (structured logs, correlation ID, consistent prefixes)?
- (g) Database?
- (h) Coding conventions?
- (i) Testing strategy? Probe one sub-question at a time, each with a recommended default and a one-line rationale: **test framework / run command / test location / coverage target**, then **"Adopt the test-design discipline, a contract-level EP/BVA/decision-table matrix on each public signature (recommended: yes; it catches edge and boundary bugs early, and kept at the contract level the tests stay robust)?"**, then, only if yes, **"Enforcement: prompt-only (the spec asks for it) or a Stop-hook gate (recommended: prompt-only to start; a stop-hook can `exit 2`-block a session that edited code with no matrix test, which is stronger but noisier)?"**. Ask only, and report the answers in the summary: `/ccf:init` does the template fill, since grill-me has no write tool.
- (j) Tech stack — must be the most stable, best-supported, least-buggy option (mainstream); for each library pick the most popular and well-maintained choice.
- (k) Monorepo rule: work in the root folder; if fullstack create `be/` + `fe/`; git init at the root, not in sub-folders; the root holds CLAUDE.md, `.claude/`, docker, CI/CD.
- (l) Git conventions: first check whether the repo already has commits (read-only `git log` / `git branch -a`). If a pattern exists, infer the commit/branch convention from it rather than inventing one. If history is empty or too thin, ask the user, or default to conventional commits (`feat:`/`fix:`/`refactor:`). This fills `git-workflow.md`'s `{{COMMIT_CONVENTION}}` / `{{BRANCH_NAMING}}` / `{{PR_RULES}}`.
