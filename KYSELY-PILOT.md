# Kysely Pilot — FieldZone + FieldRegion on PostgreSQL

This branch (`kysely-region-pilot`) is a proof-of-concept for migrating the API from Neo4j to PostgreSQL using [Kysely](https://kysely.dev/) as the query builder. The pilot covers the `FieldZone` and `FieldRegion` domains end-to-end: schema, migrations, repository, filters, and GraphQL operations.

## Why Kysely

Three ORMs were evaluated against the Project domain (the most complex): Prisma, Drizzle, and Kysely. Kysely was chosen for the pilot because:

- The existing `hydrate()` builder pattern (correlated subqueries per DTO field) ports nearly verbatim
- `filter.define()` composability can be re-implemented on Kysely's `ExpressionBuilder`
- Auth filtering via `privileges.filterToReadable()` injects through `.$call()` identically to today
- Changeset merge can be done in a single SQL query via JSONB `COALESCE` — no second round-trip
- No separate schema file — Kysely types live alongside the code, no drift from DTO decorators

Drizzle is still being evaluated on a separate branch as a comparison.

## What's in this PR

### New infrastructure

| File | Purpose |
|------|---------|
| `src/core/database/kysely/types.ts` | Central `Database` interface + per-table types |
| `src/core/database/kysely/kysely.service.ts` | NestJS-injectable `Kysely<Database>` wrapper |
| `src/core/database/kysely/migrator.ts` | Auto-runs migrations on startup when `DATABASE=postgres` |
| `src/core/database/kysely/kysely.module.ts` | Global NestJS module; imports `ConfigModule` |
| `src/core/database/kysely/migrations/2026_04_16_001_field_zones_regions.ts` | Creates `field_zones` and `field_regions` tables |
| `src/core/config/config.service.ts` | Added `postgresUrl` property |
| `src/core/database/split-db.provider.ts` | Added `'postgres'` to `DatabaseEngines` |
| `src/core/core.module.ts` | Imports and exports `KyselyModule` |

### FieldZone domain

| File | Purpose |
|------|---------|
| `src/components/field-zone/field-zone.fragments.ts` | `FIELD_ZONE_SCALAR_FIELDS` column list |
| `src/components/field-zone/field-zone.kysely.filters.ts` | Kysely filter and sorter functions |
| `src/components/field-zone/field-zone.kysely.repository.ts` | Full Kysely repository |
| `src/components/field-zone/field-zone.module.ts` | Wired into `splitDb()` under `postgres:` |

### FieldRegion domain

| File | Purpose |
|------|---------|
| `src/components/field-region/field-region.fragments.ts` | `FIELD_REGION_SCALAR_FIELDS` column list |
| `src/components/field-region/field-region.kysely.filters.ts` | Kysely filter and sorter functions |
| `src/components/field-region/field-region.kysely.repository.ts` | Full Kysely repository |
| `src/components/field-region/field-region.module.ts` | Wired into `splitDb()` under `postgres:` |

### Bug fix

`src/components/project/project-member/handlers/director-change-apply-to-project-members.handler.ts` — added null guard for `director` before accessing `.id`. Pre-existing crash when updating a zone/region that has no director assigned.

## Local setup

### 1. Start PostgreSQL

```bash
docker-compose up -d postgres
```

This starts a Postgres 16 container on port 5432 with database `cord`, user `postgres`, password `postgres`. Data is stored in `.pg.local/` (gitignored).

### 2. Add `POSTGRES_URL` to `.env.local`

The line is already in `.env.local` if you pulled this branch:

```
POSTGRES_URL=postgresql://postgres:postgres@localhost:5432/cord
```

### 3. Start the server targeting PostgreSQL

```bash
DATABASE=postgres yarn start:dev
```

On first boot the migrator runs automatically and creates the `field_zones` and `field_regions` tables (plus Kysely's internal migration tracking tables). You'll see:

```
[KyselyMigrator] Applied: 2026_04_16_001_field_zones_regions
[nest] Listening at http://localhost:3000/graphql
```

Subsequent boots skip migrations that have already run.

> **Note on hot-reload:** `yarn start:dev` watches for file changes and restarts the server. Due to a timing issue, the restarted process sometimes can't bind to port 3000 before the old one fully exits, causing a crash. If the server goes down after a file save, just re-run `DATABASE=postgres yarn start:dev`. This is a dev-only annoyance; production (`yarn start`) is unaffected.

### 4. Run without PostgreSQL (default)

Without `DATABASE=postgres` the server behaves exactly as before — Neo4j for everything. The `KyselyModule` still loads but the migrator skips and `splitDb()` routes to the existing Neo4j/Gel repositories.

## Testing it

### Get a session token (required before any other call)

```graphql
query {
  session {
    token
  }
}
```

Copy the returned token and set it as `Authorization: Bearer <token>` on all subsequent requests.

### Login

```graphql
mutation {
  login(input: { email: "devops@tsco.org", password: "admin" }) {
    user { id }
  }
}
```

### Create a FieldZone

The director must be a user with the `FieldOperationsDirector` role.

```graphql
mutation CreateFieldZone($input: CreateFieldZone!) {
  createFieldZone(input: $input) {
    fieldZone {
      id
      name { value }
    }
  }
}
```

```json
{
  "input": {
    "name": "My Test Zone",
    "director": "<user-id-with-FieldOperationsDirector-role>"
  }
}
```

### Create a FieldRegion

Use the zone ID returned above. The director must have the `RegionalDirector` role.

```graphql
mutation CreateFieldRegion($input: CreateFieldRegion!) {
  createFieldRegion(input: $input) {
    fieldRegion {
      id
      name { value }
    }
  }
}
```

```json
{
  "input": {
    "name": "My Test Region",
    "fieldZone": "<zone-id-from-above>",
    "director": "<user-id-with-RegionalDirector-role>"
  }
}
```

> **Important:** The zone ID must come from a zone created while `DATABASE=postgres` is set. IDs from the Neo4j database will fail the foreign key constraint because those zones don't exist in PostgreSQL's `field_zones` table. Both databases run simultaneously; `splitDb()` routes each domain independently.

### List and read

```graphql
query {
  fieldZones { total items { id name { value } } }
  fieldRegions { total items { id name { value } } }
}
```

```graphql
query {
  fieldZone(id: "<id>") { id name { value } }
  fieldRegion(id: "<id>") { id name { value } }
}
```

## Architecture notes

### How `splitDb()` works

`splitDb()` is a NestJS provider factory that reads the `DATABASE` env var at startup and returns the matching repository class. The service and resolver layers are completely unaware of which repo they're talking to:

```typescript
splitDb(FieldZoneRepository, {
  gel:      FieldZoneGelRepository,   // DATABASE=gel
  postgres: FieldZoneKyselyRepository // DATABASE=postgres
})
// default (no match) → FieldZoneRepository (Neo4j)
```

Everything above the repository — loaders, services, resolvers, auth — is unchanged.

### Repository pattern

Each Kysely repository follows this structure:

- **`SCALAR_FIELDS` constant** — the column list passed to every `.select()`, defined in a `fragments.ts` file
- **`readOne` / `readMany`** — standard select with `deleted_at IS NULL` guard
- **`create`** — duplicate check, `generateId()`, `insertInto`
- **`update`** — builds a `values` object from changes, calls `updateTable`
- **`deleteNode`** — soft delete via `deleted_at = now()`
- **`list`** — parallel count + page query, calls filter and sorter helpers
- **`getActualChanges`** — `getChanges(ResourceClass)` from `~/core/database/changes`; required by the service layer
- **`toDto`** — maps raw DB row to `UnsecuredDto<T>`

### What's stubbed / not yet ported

| Item | Status |
|------|--------|
| Auth filter (`privileges.filterToReadable()`) | Stubbed as `noOpFilter` — all rows pass through, no auth enforcement at the DB layer. The service-layer `secure()` call still applies field-level visibility. |
| `director` sub-filter on FieldZone/FieldRegion list | TODO — needs `filter.sub()` re-implemented for Kysely `ExpressionBuilder` |
| `fieldZone` sub-filter on FieldRegion list | TODO — same |
| Transactions | Not yet wired — mutations aren't wrapped in a Postgres transaction. The Neo4j transactional interceptor has no Kysely equivalent yet. |
| E2E tests | `test/zone.e2e-spec.ts` and `test/region.e2e-spec.ts` not yet ported to run against PostgreSQL |

The `noOpFilter` stub means the list endpoints return all non-deleted rows to any authenticated user. This is intentional for the pilot — the auth layer port is a Phase 1 gating item for the full migration, not the pilot scope.

## Key implementation gotchas

**`KyselyService` uses `ConfigService`, not `process.env`**
`EnvironmentService` loads `.env.local` into its own dict — it does not set `process.env`. Accessing `process.env.POSTGRES_URL` directly always returns `undefined`. Always read connection strings through `ConfigService`.

**`.$call()` not `.apply()`**
Kysely 0.28.x uses `.$call(fn)` for query composition. The plan docs reference `.apply()` which doesn't exist on the current version.

**IDs are `text`, not `uuid`**
All resource tables use 11-char nanoid strings from `generateId()`. The Kysely `Database` interface uses `Generated<string>` for PK columns. Do not use `uuid` column type or `DEFAULT gen_random_uuid()`.

**Timestamp columns are never writable on insert**
`created_at` and `updated_at` have DB defaults. Their Kysely types are `ColumnType<Date, never, never>` and `ColumnType<Date, never, Date>` respectively — omit them from `insertInto().values()` or TypeScript will error.

**The `as any` cast on `splitDb`**
`PublicOf<FieldZoneRepository>` includes Neo4j base class members (`privileges`, `getBaseNode`, etc.) that don't exist on the Kysely repo. This cast goes away once a proper `IFieldZoneRepository` interface is defined.
