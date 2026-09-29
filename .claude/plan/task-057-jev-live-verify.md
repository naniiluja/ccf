# Task 057 — live verification and calibration (needs a real TYPESAFE_API_KEY)

- **Depends on:** 056
- **Gate:** every measurement below recorded as observed; anything not run is written down as "not observed", never treated as done

## Measure
- [ ] Latency of one real request versus the 6.5s abort and the 10s hook timeout
- [ ] Real limits: `state` size and question count per request (the docs state neither); adjust the 200KB cap and the 40-question batch
- [ ] Calibrate the 0.5 threshold on closed tasks in `ARCHIVE.md` (known outcomes) and on one deliberately unmet criterion; the check must be seen RED before it is trusted
- [ ] Run the real Stop hook after reinstalling the plugin (the plugin runs from the cache, not from this repo)
- [ ] Record cost per Stop from `usage`

## Results (observed 2026-09-29, real key from settings.json, repo copy of the code)
- **Latency:** 270 to 780 ms for a tiny request, 318 to 967 ms with 9-24KB states, 1.27 s for the whole real hook (git + request + print). Far under the 6.5 s abort and the 10 s hook timeout.
- **Limits (docs state none):** the request limit is on INPUT TOKENS, about 33K: 110KB of source (32.8K tokens) succeeded, 120KB failed with HTTP 400 `max_tokens_exceeded`; prose 140KB passed, 160KB failed. Source tokenizes at about 3.4 bytes/token. The byte cap therefore moved from a guessed 200KB to a measured-and-margined 80KB. Question count: 400 in one request succeeded, so the slice-check batch moved from 40 to 100.
- **Cost:** `usage` reports input tokens only (no price in the docs): 3.2K to 8K input tokens per Stop for a 9-24KB diff, about 18 output tokens per question.
- **Calibration, 28 hand-labelled criteria (15 met, 13 unmet; labels written before reading any answer) on the real diffs of tasks 054/055/056:** met criteria scored 0.47 to 0.98 (median about 0.92), unmet 0.02 to 0.57 (median about 0.05). Threshold 0.5 caught 12/13 unmet with 1 false alarm in 15 met; 0.6 caught 13/13 with the same 1 false alarm. The unmet items I invented were mostly blatant (an SDK, Python, SQLite), so this flatters Jev.
- **Sensitivity, 8 defects injected into real code (remove the marker check, the stop_hook_active guard, the key check, the edit guard; make failure noisy; ignore the timeout; drop `secret` from the sensitive-name regex; change `<=` to `<` at the size cap):** in every case the criterion's score fell (control 0.93-0.99, one 0.66; mutants 0.06-0.72). At 0.5 it caught 6/8 with 0/8 controls flagged; the two misses (0.72 key check, 0.63 secret regex) are single-token edits, and the key-check mutant arguably still met the requirement because `askJev` refuses a missing key itself. The "RED first" condition holds: the detector went red on known-bad input.
- **Real hook, end to end (small fixture repo, real network):** one criterion true, one false (retry with backoff), one true (key never printed): the message named exactly the false one, exit 0, key absent from stdout/stderr. On the live D:\ccf working tree (122KB tracked diff) the diff exceeds the cap; the hook now says "not checked" once instead of staying silent.
- **NOT observed:** the plugin reinstalled from the cache; a real Claude Code Stop event firing the hook (both need a reload of this session, which only the user can do); anything about TypeSafe's retention or training policy (docs silent, so the diff-leaves-the-machine warning stays).