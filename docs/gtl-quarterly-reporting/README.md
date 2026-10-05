# GTL Quarterly Reporting × Quarterly Report Intake — Alignment

Three separate efforts have independently touched the same `posts` table, the same `Postable`
interface, and the same "prayer request" concept, in three overlapping but incompatible ways:

1. **GTL Quarterly Reporting** (`gtl-reports` branches, cord-api-v3 + cord-field) — this repo's
   own recent work, POC-complete and verified locally on Postgres, not yet pushed.
2. **Quarterly Report Intake improvement** (`partner-quarterly-reporting` branches) — bringing
   Momentum field partners into Cord directly, in active build.
3. **Prayer Requests in Cord** (design only, dated 2026-09-10) — a portfolio-wide redesign of the
   whole Post/Prayer/Story domain that supersedes parts of #2's already-written code and names the
   exact fix #1 needs.

This directory is the reconciliation: what disagrees, why, and what changes before any of these
branches can merge without colliding.

| Doc | Purpose |
| --- | --- |
| [`ALIGNMENT.md`](./ALIGNMENT.md) | The finding — ten concrete conflicts between GTL and the other two efforts, with file/line evidence. Read this first. |
| [`PRD.md`](./PRD.md) | What GTL's Post-domain surface (prayer, media, moderation) should look like once reconciled, and why. |
| [`BUILD_PLAN.md`](./BUILD_PLAN.md) | Work breakdown to get there — workstreams, dependencies, rough sizing, sequencing, risks. |
| [`epics/`](./epics) | One file per epic, formatted as a ready-to-paste `initiatives` repo Epic issue body plus its implementation stories. |

## Status

Draft, for review by whoever ends up owning the shared Post/Prayer domain across these three
efforts — currently that's split across this GTL work (Seth McKnight), Quarterly Report Intake
(Bryan Nelson, sponsor Abby Roberts), and the Prayer Requests plan of record (Seth McKnight). No
code changes have been made as a result of this review; GTL's 15 local API commits and 12 local
field commits on `gtl-reports` are unchanged and still unpushed.

## Sources

- `gtl-reports` branches: `.worktrees/cord-api-v3-gtl-reports`, `.worktrees/cord-field-gtl-reports`.
- `partner-quarterly-reporting` branches: `cord-api-v3-partner-quarterly-reporting`,
  `.worktrees/cord-field-partner-quarterly-reporting`. Design: "Retiring the Narrative Doc" (rev 5,
  25 Aug 2026). Build sheet: "Partner Reporting Build Sheet" (25 Aug 2026).
- Prayer Requests plan of record: "Prayer Requests in Cord" (10 Sep 2026).
