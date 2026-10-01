# CCF — Claude Context First

**English** · [Tiếng Việt](./README.vi.md) · [简体中文](./README.zh-CN.md)

A plugin for [Claude Code](https://code.claude.com) that keeps your AI coding assistant disciplined: plan first, keep the project spec fresh, check work against the spec, and run independent tasks in parallel.

## Why use it

Plain Claude Code is a sharp assistant with a short memory. Over a long session it forgets your project rules, lets planning slide into editing files, and never reminds you to update the docs. CCF adds three habits that stick:

- **Plan before code.** `/ccf:plan` only runs in plan mode, so planning stays read-only and reviewable. No accidental edits.
- **Spec stays fresh.** Hooks (small scripts that fire on session events) nudge you to update the spec when the code changes. Lessons you learn get saved into system memory, so mistakes stop repeating.
- **Check before done.** `/ccf:check` reviews each finished task against the spec with two independent reviewers. Nothing counts as done until it passes.

## Install

In Claude Code:

```
/plugin marketplace add naniiluja/ccf
/plugin install ccf@ccf
```

Or in one step: `npx @naniiluja/ccf`

Then open Claude Code in your project folder and run `/ccf:init`.

## The 5 commands

| Command | What it does, in plain words |
|---|---|
| `/ccf:init` | Set up CCF in your project. It interviews you, then writes the project spec (`CLAUDE.md`). For an existing project, it reads your real codebase first and mirrors its structure. |
| `/ccf:plan` | Break one feature into small ordered slices (database, then service, then UI), each with its own test. Requires plan mode (Shift+Tab). |
| `/ccf:cook` | Run the slices in parallel waves. Tasks with no link between them run at the same time, each in its own isolated copy of the repo (a git worktree); tests run after every merge. |
| `/ccf:check` | Review finished work against the spec. The single mandatory step before a task is marked done. |
| `/ccf:updatespec` | Write this session's lessons back into the spec and the system memory. |

Typical flow: `/ccf:init` → `/ccf:plan` → `/ccf:cook` → `/ccf:check` → `/ccf:updatespec`.

## Under the hood

You don't need this section to use CCF. It's here for the curious.

- **Hooks** are the deterministic layer. Commands and agents are prompts, and a model can ignore a prompt. Hooks are scripts that run on session events no matter what: they block `/ccf:plan` outside plan mode, nudge a spec update when code changed, and re-load your in-progress task after a compact.
- **Agents** are 5 read-only helpers: one reads slices of your codebase, one fetches best practices from official docs, one drafts spec text, two review your work. None of them write code. You write the code, directly in the session.
- **Docs lookup built in.** The plugin ships Context7 and Microsoft Learn (MCP servers), so design advice cites real documentation instead of model memory.

Full internals reference: [plugins/ccf/README.md](./plugins/ccf/README.md). Requires Node ≥ 18 for the hooks.

## License

MIT

## Acknowledgements

First released in the [LINUX DO](https://linux.do/) community. Thanks for the support and feedback.
