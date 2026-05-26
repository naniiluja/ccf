---
description: Generate an optimal compaction hint from the in-progress task, then guide you to run /compact <hint> — so you compact proactively instead of letting auto-compact fire when context has already rotted.
argument-hint: ""
allowed-tools: Read, Glob, Grep
model: sonnet
---

You are running CCF `/ccf-compact`. Goal: help the user **compact proactively with a hint** instead of letting auto-compact fire on its own.

## Why
Auto-compact triggers when context is already full — exactly when the model is least sharp (context rot), so its summary tends to keep the wrong things. Proactive early compaction with a specific hint keeps exactly what matters.

> Note: you (Claude) CANNOT run `/compact` yourself. This command only **generates the best hint** and prints the line for the user to copy.

## Steps
1. **Identify the in-progress task:** read `.claude/plan/PLAN.md` and find the task with status `in-progress`. Read its `task-NNN-*.md` (goal, spec refs, files to touch, outstanding acceptance criteria). If there is no in-progress task, fall back to the most recent work in this session.
2. **Summarize what to KEEP:** task NNN + goal + spec refs + the file(s) being edited + key decisions/findings made this session.
3. **Summarize what to DROP:** resolved debug logs, exploration output no longer relevant, abandoned approaches, long outputs already consumed.
4. **Print the exact line for the user to copy**, in this shape:
   ```
   /compact focus on <task NNN + goal + file being edited + decisions to keep>, drop <what is no longer relevant>
   ```
5. Remind the user: after compacting, CCF's SessionStart hook will automatically re-load the in-progress task from the plan, so they don't need to paste the whole context back.

Keep the hint short, specific, and focused on the current task.
