# Task 071 — memory-audit script + gated consolidation step in /ccf:updatespec (+ opt-in Jev column)

- **Vertical slice:** pure lib (`lib/memory-audit.mjs`) + read-only script (`scripts/memory-audit.mjs`, opt-in Jev call through the existing `lib/jev-client.mjs#askJev`) + prompt (`commands/updatespec.md` step 5) + tests
- **Depends on:** —
- **Spec refs:** `.claude/rules/architecture.md` (Script); `.claude/rules/components.md` (a command that asks must carry `AskUserQuestion`; YAML `": "` trap, run `claude plugin validate` after a frontmatter edit); `.claude/rules/prompt-standard.md` (prompt prose); `commands/updatespec.md` step 5; approved plan `lifecycle-cleanup` (decisions 3, 4, 5); `.claude/rules/hooks.md` `completion-evidence` (Jev rules: key from env only, never printed; sensitive-content handling; no truncation of an oversize payload) and `.claude/rules/tooling.md` (`jev-verify-findings.mjs` annotate-only precedent).
- **MCP to use:** none
- **Gate (must be GREEN before task 072):** unit + script integration on temp memory dirs. `node --test plugins/ccf/hooks/lib/*.test.mjs` green, `tsc` exit 0, `claude plugin validate plugins/ccf` passed, plus the smoke run on this repo's real memory dir. Jev is tested ONLY against a `node:http` fake on 127.0.0.1 via `CCF_JEV_URL` (no real API call in the suite). **discipline: on**, so the matrix below, including the `jev` column and every fallback path, must be present AND actually run.

## Goal (one sentence)
Project memory gets a periodic consolidation pass that runs only when a deterministic gate opens (more than 20 `feedback` files, or `MEMORY.md` at 150+ lines or 20KB+), and every deletion or merge is previewed and confirmed by the user once; with an explicit opt-in, Jev adds an advisory keep/merge/drop label and score per memory to that preview, never deciding anything itself.

## Design
- `lib/memory-audit.mjs` (pure): `parseMemoryFrontmatter(text)` → `{ name, description, type, modified }` (missing or malformed frontmatter → `type: "untyped"`, never `feedback`); `auditMemory({ indexText, files: [{ name, text }] })` → counts by type, index lines/bytes, `danglingIndex` (index links to a missing file), `unindexed` (file not linked from the index); `shouldConsolidate({ feedbackCount, indexLines, indexBytes }, { maxFeedback, indexLines, indexKb })` → `{ gate, reasons }` with reasons `feedback-count` / `index-lines` / `index-bytes`. Thresholds: feedback `> maxFeedback`; index `>= indexLines` or `>= indexKb * 1024`.
- `scripts/memory-audit.mjs`: `--memory-dir <path>` REQUIRED (the docs define no path derivation, and the main session knows its own memory path), `--max-feedback 20 --index-lines 150 --index-kb 20`. Prints JSON `{ gate, reasons, counts, index, danglingIndex, unindexed, files: [{ file, type, modified }] }` and always exits 0. Read-only. Missing dir → `{ gate: false, reason: "no-memory-dir" }`; missing `--memory-dir` → `{ gate: false, reason: "no-memory-dir-arg" }`. Only top-level `*.md` files are read; `MEMORY.md` is the index, not a memory.
- `commands/updatespec.md` step 5:
  - **Write-time quality gate** before creating a memory: would forgetting it cause a repeat mistake? is it specific to this project or user? does it already exist? Exact match → skip; partial overlap → merge into the existing file; contradiction → this session's fact wins and the old file is updated.
  - **5b. Consolidate (gated):** run `memory-audit.mjs --memory-dir <this session's memory dir>`. When `gate` is false, say so in one line and stop. When true: Orient (read the index + files), Gather signal (first: does the current code contradict the memory, e.g. a named file, flag or function no longer exists; then duplicates, superseded entries, `danglingIndex`/`unindexed`), Consolidate (propose merges), Prune and Index. Print one proposal table (file, action keep/merge into X/drop, reason), ask ONCE with `AskUserQuestion` (apply all / choose / skip), apply only what was approved, and rewrite `MEMORY.md` to one line per remaining memory.
  - Add `AskUserQuestion` to the frontmatter `allowed-tools`.
  - When `TYPESAFE_API_KEY` is set, step 5b passes `--jev` and states in one sentence, before running it, that the memory files (including `user`-type memories) are sent to api.typesafe.ai. The table gains a `jev` column (`label score`, e.g. `drop 0.82`) only for files the JSON carries a `jev` entry for. The model's own action column stays authoritative: a Jev label is a hint the model may cite or overrule, never a reason by itself to drop.

## Jev column (opt-in, advisory only; user consented 2026-10-01 to sending `user`-type memories for this)
- **Opt-in needs BOTH:** `--jev` on `memory-audit.mjs` AND `TYPESAFE_API_KEY` in the environment (never argv, never printed). Jev is asked only when `gate` is true; a closed gate never calls the network.
- **Request:** one `askJev` call (`lib/jev-client.mjs`, reused, not copied). `state` = every memory file's `file` name + full text (frontmatter included) + the `MEMORY.md` index. Questions = three Nouls per memory (`<file>::keep`, `<file>::merge`, `<file>::drop`: "should this memory be kept as is / merged into another memory listed in state / dropped as stale, duplicate or wrong?"). A pure `buildJevMemoryRequest(files, indexText)` builds it; a pure `labelFromAnswers(answers, files)` turns answers into `{ label, score }` per file = the highest of the three scores. A file missing any of its three answers gets no `jev` entry.
- **Size cap:** the serialized `state` over 80KB (same cap and reason as `completion-evidence`/`jev-verify-findings`: HTTP 400 above about 33K input tokens) is NOT sent and NOT truncated.
- **Output:** each `files[i]` gains `jev: { label, score }` when available; top level gains `jev: "ok" | "off" | "no-key" | "gate-closed" | "nothing-to-ask" | "too-large" | "<askJev reason>"` (`unauthorized`, `rate-limited`, `timeout`, `network`, `http-NNN`, ...). Every non-`ok` value means no `jev` entries at all, exit 0, and step 5b proceeds exactly as without Jev (the silent fallback: the table just has no `jev` column; the status is in the JSON, not shouted at the user).
- **Timeout:** the script uses `askJev`'s `timeoutMs` at 30s like `jev-verify-findings.mjs` (a script, not a hook, so the 10s hook kill does not apply).
- **Why advisory only:** about 68% backtest accuracy on this repo's harness work; memory is outside git, so a wrong drop is unrecoverable. The prompt must keep the model's proposal and the single user confirmation as the only path to a change.

## Acceptance criteria (verifiable)
- [ ] `shouldConsolidate` opens at 21 feedback files and not at 20; opens at 150 index lines and not at 149; opens at 20480 bytes and not at 20479; reasons list every threshold crossed.
- [ ] A file without frontmatter counts as `untyped` and never toward the feedback gate.
- [ ] `danglingIndex` and `unindexed` are reported correctly on a fixture with one of each.
- [ ] The script on this repo's memory dir (`/home/hatch/coder/.claude/projects/-home-hatch-coder-ccf/memory`) returns `gate: false`; a temp fixture with 21 feedback files returns `gate: true`, reasons `["feedback-count"]`; the script changes no file (directory listing + mtimes identical before and after).
- [ ] `updatespec.md` carries the write-time gate, step 5b and `AskUserQuestion` in `allowed-tools`; `claude plugin validate plugins/ccf` passes.
- [ ] With `--jev` + key + open gate against the fake server, every file gets `jev: { label, score }` (the highest of its three answers) and top-level `jev: "ok"`; the request `state` contains each memory's text and the index, and the key never appears in stdout/stderr.
- [ ] Fallbacks, each with no `jev` entries, exit 0 and an otherwise identical audit: no `--jev` → `"off"`; `--jev` without key → `"no-key"`; gate closed → `"gate-closed"` and ZERO requests reach the fake; state over 80KB → `"too-large"` and zero requests; fake returns 401/429/500, bad JSON, or hangs past the timeout → the `askJev` reason.
- [ ] A file whose three answers are incomplete gets no `jev` entry while the others still do.
- [ ] `updatespec.md` step 5b states the data-leaves-the-machine sentence before a `--jev` run, and states that the `jev` column never decides an action on its own.

## Test first (write before implementing; confirm RED)
- `plugins/ccf/hooks/lib/memory-audit.test.mjs` (new): pure functions.
- `plugins/ccf/hooks/lib/memory-audit-script.test.mjs` (new): spawn the script against `mkdtempSync` memory dirs.
- **Matrix (contract level):**
  - EP: frontmatter ∈ {typed feedback, typed other, untyped/no frontmatter, malformed YAML}; index state ∈ {clean, dangling link, unindexed file, both}; dir ∈ {present, missing, no arg}.
  - BVA: feedback count {20, 21}; index lines {149, 150}; index bytes {20479, 20480}; empty dir (0 files).
  - Decision table: feedback gate {open, closed} × index gate {open, closed} → `gate` and `reasons` for all 4 combinations.
  - **Jev decision table:** `--jev` {yes, no} × key {set, unset} × gate {open, closed} × payload {≤ 80KB, > 80KB} × API {ok, error} → Jev called only on (yes, set, open, ≤ 80KB); the `jev` status for every other row as listed above (precedence: off → no-key → gate-closed → too-large → API reason).
  - **Jev EP:** answer set per file ∈ {all three present, one missing, none}; API outcome ∈ {200 valid, 200 malformed body, 401, 429, 500, timeout}; label winner ∈ {keep, merge, drop}, plus a tie (deterministic tie-break keep > merge > drop, the least destructive wins).
  - **Jev BVA:** serialized state at exactly 80KB (sent) and 80KB + 1 byte (`too-large`); scores 0 and 1; a single memory file; zero memory files with an open index gate (no questions → no request, `jev: "ok"` with nothing to label is NOT allowed; report `"nothing-to-ask"`).

## Files to touch
- `plugins/ccf/hooks/lib/memory-audit.mjs` — new
- `plugins/ccf/hooks/lib/memory-audit.test.mjs` — new
- `plugins/ccf/scripts/memory-audit.mjs` — new
- `plugins/ccf/hooks/lib/memory-audit-script.test.mjs` — new
- `plugins/ccf/commands/updatespec.md` — step 5 write-time gate + 5b + `allowed-tools` + Jev column wording
- (reused, not modified) `plugins/ccf/hooks/lib/jev-client.mjs`

## Steps (thin end-to-end slice)
1. Write the failing tests (matrix above) and confirm RED.
2. Implement the lib, then the script, then the `updatespec.md` step.
3. Run the gate commands and the smoke run; record actual results below, then mark the task `in-review` (NOT `done`).
4. `/ccf:check` → `/ccf:updatespec`; only that writes `done`.

## Notes / best-practice sources
- code.claude.com/docs/en/memory (via Context7 `/websites/code_claude`): `MEMORY.md` loads its first 200 lines or 25KB; Claude Code asks to "merge or drop stale entries" near the limit; topic files load on demand; a `modified` ISO 8601 frontmatter field is recorded on write since v2.1.214. The glossary says auto memory is stored per git repository under `~/.claude/projects/`, but not how the folder name is derived, hence `--memory-dir` is required.
- Anthropic Dreams consolidation phases (Orient, Gather Signal, Consolidate, Prune and Index), run periodically and gated rather than every session.
- Jev classification was first deferred in planning (accuracy vs irreversibility, privacy); the user decided on 2026-10-01 to include it now as an opt-in, advisory-only column and consented to sending `user`-type memories. The irreversibility concern is handled by keeping the model's proposal + one user confirmation as the only path to a change and by a least-destructive tie-break.

## Results
(fill in during implementation)
