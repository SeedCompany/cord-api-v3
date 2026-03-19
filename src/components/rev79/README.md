# Rev79 Integration

## Overview (non-technical)

Rev79 is an external system that tracks Bible translation projects and community groups under different identifiers than Cord. This module bridges the two systems, allowing Rev79 to push progress report data into Cord without needing to know Cord's internal IDs.

Two capabilities are provided:

- **Resolve context** — given a Rev79 project ID, community ID, and calendar quarter, returns the matching Cord project, language engagement, and progress report IDs along with the report date range. Useful for Rev79 to look up the right Cord records before doing anything.
- **Bulk upload** — given a Rev79 project ID and a list of community reports, writes team news, community story, product progress, and media images into the matching Cord progress reports in a single call.

Authorization is enforced: if the caller cannot read a project, it appears as not found (the same as if it didn't exist) to avoid leaking project existence.

---

## Technical reference

### GraphQL API

#### Query: `rev79QuarterlyReportContext`

Resolves Cord IDs for a single community+quarter combination.

**Input** (`Rev79QuarterlyReportContextInput`):

| Field | Type | Description |
|---|---|---|
| `rev79ProjectId` | `String` | Rev79's project identifier |
| `rev79CommunityId` | `String` | Rev79's community identifier |
| `period.year` | `Int` | Fiscal year (e.g. 2024 = Oct 1 2023 – Sep 30 2024) |
| `period.quarter` | `Int` | Fiscal quarter 1–4 (Q1 = Oct–Dec, Q2 = Jan–Mar, Q3 = Apr–Jun, Q4 = Jul–Sep) |

**Result** (`Rev79QuarterlyReportContextResult`):

| Field | Type | Description |
|---|---|---|
| `project` | `ID` | Cord Project ID |
| `engagement` | `ID` | Cord LanguageEngagement ID |
| `progressReport` | `ID` | Cord ProgressReport ID |
| `start` | `Date` | First day of the quarter |
| `end` | `Date` | Last day of the quarter |

---

#### Mutation: `uploadRev79ProgressReports`

Bulk-writes progress report data for multiple communities under a single Rev79 project.

**Input** (`Rev79BulkUploadProgressReportsInput`):

| Field | Type | Description |
|---|---|---|
| `rev79ProjectId` | `String` | Rev79's project identifier |
| `reports` | `[Rev79ReportItemInput!]!` | One entry per community+quarter |

Each `Rev79ReportItemInput` supports:
- `rev79CommunityId` + `period` — identifies the target progress report
- `teamNews` — optional rich-text response for the team news prompt
- `communityStories` — optional list of `{ promptId, response }` pairs
- `productProgress` — optional list of step-level progress updates per product
- `media` — optional list of `{ url, category? }` image references (see below)

**Media (`Rev79MediaInput`)**

| Field | Type | Description |
|---|---|---|
| `url` | `String` | Signed GCS URL for the image to download |
| `category` | `ProgressReportMediaCategory` (optional) | `Team`, `WorkInProgress`, `CommunityEngagement`, `LifeInCommunity`, `Events`, `SceneryLandscape`, `Other` |

Each image is fetched from the provided URL at mutation time and stored in Cord's S3 bucket as a `draft` variant `ProgressReportMedia` record. This means Rev79's signed GCS URLs (which expire) are only needed at upload time — Cord owns the file permanently after that.

---

### Error types

All errors are domain-typed so callers can distinguish failure reasons:

| Code | Cause |
|---|---|
| `Rev79ProjectNotFound` | No Cord project has the given `rev79ProjectId`, or the caller cannot read it |
| `Rev79CommunityNotFound` | No language engagement in the project has the given `rev79CommunityId` |
| `AmbiguousRev79Community` | Multiple engagements share the same `rev79CommunityId` — data integrity issue |
| `QuarterOutOfRange` | `period.quarter` is outside 1–4 |
| `ProgressReportNotFound` | No progress report exists for the resolved engagement covering the requested quarter |

---

### Module structure

```
rev79/
  dto/
    quarter-period.input.ts                  # Shared year+quarter input type
    rev79-quarterly-report-context.input.ts  # Input for the context query
    rev79-quarterly-report-context.result.ts # Result for the context query
    upload-progress-reports.input.ts         # Input types for bulk upload
    upload-progress-reports.result.ts        # Result for bulk upload
  migrations/
    fix-rev79-active-flag.migration.ts       # One-time fix for active=null Neo4j relationships
  rev79.exceptions.ts     # Typed domain exceptions
  rev79.repository.ts     # Neo4j queries
  rev79.gel.repository.ts # EdgeDB (Gel) queries
  rev79.module.ts         # NestJS module
  rev79.resolver.ts       # GraphQL resolver
  rev79.service.ts        # Business logic
  rev79.service.spec.ts   # Unit tests
```

The repository is split between Neo4j (`Rev79Repository`) and EdgeDB (`Rev79GelRepository`) via `splitDb`, matching the dual-database pattern used elsewhere in Cord.

### Key dependencies

- `ProjectService.readOne` — used to enforce authorization on project lookup
- `PeriodicReportService.getReportByDate` — resolves the progress report for a given engagement + quarter start date
- `ProgressReportTeamNewsService` / `ProgressReportCommunityStoryService` — write prompt variant responses; both are exported from `ProgressReportModule`
- `ProductProgressService.update` — writes step-level product progress
- `ProgressReportMediaService.upload` — downloads images from Rev79 URLs and stores them in S3; exported from `ProgressReportMediaModule` (re-exported by `ProgressReportModule`)

### Data model assumptions

- `rev79ProjectId` is stored as an active `Property` node on `Project` (Neo4j) or a scalar property (EdgeDB). Uniqueness is not enforced at the schema level — the service treats multiple matches as a data integrity issue and surfaces the first match.
- `rev79CommunityId` is stored on `LanguageEngagement`. The service requires exactly one match per project+community pair.
- Progress reports are auto-generated when a language engagement is created, covering the project's date range in quarterly intervals.
