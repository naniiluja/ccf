# Task 054 — Jev core: HTTP client + pure completion-evidence logic

- **Vertical slice:** two pure/injectable libs + their tests + one `plan.mjs` helper. No hook, no real network.
- **Depends on:** 052 (deliberate: not 053, which is a manual live observation with no code dependency)
- **Spec refs:** `.claude/rules/hooks.md` (no-dependency, fail-open, I/O in the hook not the lib), `coding-conventions.md` (JSDoc, `node:` prefix), `testing.md` (a latch never seen RED proves nothing)
- **MCP to use:** none (API contract already read from docs.typesafe.ai)
- **Gate (must be GREEN before the next slice):** `node --test plugins/ccf/hooks/lib/*.test.mjs` + `npx -p typescript tsc --noEmit`

## Goal (one sentence)
Give the later hook a tested way to call TypeSafe Jev without a dependency and to turn a task's acceptance criteria plus a diff into Noul questions and back into a list of unmet criteria, with every failure returned as data, never thrown.

## Acceptance criteria (verifiable)
- [ ] `askJev({ apiKey, baseUrl, state, questions, timeoutMs, fetchImpl })` returns `{ ok: true, answers, usage }` on 200 and `{ ok: false, reason }` for: empty key (no fetch call at all), 401, 422, 429, 529, other non-2xx, non-JSON body, JSON missing `answers`, network error, and abort at `timeoutMs`; it never throws and never puts the key in `reason`
- [ ] The request is `POST {baseUrl}/v1/systemone` with header `Authorization: Bearer <key>`, body `{ state, model: "jev-latest", questions }`
- [ ] `extractAcceptanceCriteria(taskFileText)` returns the checkbox lines under `## Acceptance criteria` (text without the `- [ ]` marker), `[]` for a missing section or non-string input
- [ ] `isSensitivePath(path)` is true for `.env*`, `*.pem`, `*.key`, `id_rsa*`, and names containing `credential` or `secret`; false for ordinary source
- [ ] `filterDiffSections(diffText)` drops whole `diff --git` sections for sensitive paths and reports their names
- [ ] `withinSizeCap(text, capBytes)` counts UTF-8 bytes; over the cap the builder returns a skip result, it never truncates
- [ ] `buildEvidenceRequest({ task, criteria, diff, testOutput })` returns `state` with named fields plus one Noul per criterion and one scope-creep Noul, question ids stable (`criterion_1`...)
- [ ] `unmetCriteria(answers, criteria, threshold)` lists criteria whose `noul` is below `threshold`; a missing or non-numeric answer is reported as unjudged, not as met
- [ ] `plan.mjs#findInReviewTask(file)` returns the first `in-review` row only (not `in-progress`), null when the file is missing

## Test first (write before implementing)
`hooks/lib/jev-client.test.mjs` and `hooks/lib/completion-evidence.test.mjs`, one case per input flipped, plus garbage input. Confirm RED before writing the libs, then mutate one branch of each lib and confirm a test goes red.

## Files to touch
- plugins/ccf/hooks/lib/jev-client.mjs (new, `fetch` injected)
- plugins/ccf/hooks/lib/completion-evidence.mjs (new, pure)
- plugins/ccf/hooks/lib/plan.mjs (add `findInReviewTask`)
- plugins/ccf/hooks/lib/jev-client.test.mjs, completion-evidence.test.mjs, plan.test.mjs (new/extend)

## Notes
Node 18 global `fetch` is enough; do not add `@typesafe-ai/sdk` (needs Node 20 and is a dependency). The 200KB cap and the 0.5 threshold are provisional; task 057 calibrates them.
