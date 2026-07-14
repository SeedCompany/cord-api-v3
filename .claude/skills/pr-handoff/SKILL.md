---
name: pr-handoff
description: >-
  Generate a review handoff / PR description for a migration PR in Rob's
  preferred format — H3 headers + bullets (no tables), wrapped in a 4-backtick
  fence for clean paste, with a schema/DDL section. Use when asked for a
  "handoff", "PR description", "review doc", or "something another AI can review".
---

# PR handoff / description generator

Produce a review handoff for the current PR. Format rules (non-negotiable):
- **H3 (`###`) headers + bullets. NO tables.**
- **Wrap the entire doc in a 4-backtick fence** so it pastes as one markdown block.
- Include a **schema/DDL section** whenever the PR touches the database.

## Sections (in order)
1. **Title + one-paragraph context** — what the PR is, where it sits in the
   stack/migration, its branch + base. For a recut, state that mono
   (`pg-e2e-harness`) is the already-validated source of truth, so the review
   standard is "parity with mono + the intentional deltas below."
2. **Files** — path · one-line purpose · insertions.
3. **What's added** — the substantive changes, grouped logically.
4. **Intentional deltas vs mono** — anything that deviates from the source of
   truth, with the reason (drift fixes, decisions, strips). Tell the reviewer
   to focus their attention here.
5. **Validation performed** — the exact gates that passed: type-check, lint,
   fresh-DB migration apply, smoke tests, dual-engine e2e counts.
6. **Reviewer cross-checks** — specific things to verify independently
   (enum↔DTO parity, schema↔SQL, generated-CASE↔app-source, journal idx).
7. **Explicitly out of scope** — deferred work, so the reviewer doesn't flag it
   as missing.

## Notes
- Be precise and concrete (file:line, exact commands, counts) — the reader is
  another AI that will verify claims.
- Distinguish what was verified by **testing** vs by **reasoning/reading** —
  never imply test coverage that doesn't exist.
