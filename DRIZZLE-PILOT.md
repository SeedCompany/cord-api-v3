# Drizzle ORM Pilot — FieldZone + FieldRegion

## What this is

A proof-of-concept demonstrating [Drizzle ORM](https://orm.drizzle.team) as the PostgreSQL query layer for the Neo4j → PostgreSQL migration. It migrates `FieldZone` and `FieldRegion` end-to-end and keeps the rest of the app on Neo4j using the existing `splitDb()` provider.

**Branch:** `drizzle-region-pilot`
**Comparison:** See also `kysely-region-pilot` — same domains, same approach, different query library.

### Design philosophy

This pilot deliberately uses the **straightforward relational approach** rather than porting the Neo4j composable patterns. Neo4j's `hydrate()` builder, `filter.define()`, and `.apply()` chain were designed to solve Neo4j-specific problems (property nodes, graph traversal, Cypher query construction). PostgreSQL doesn't have those problems.

The approach here:
- **Relational API** (`db.query.X.findFirst/findMany`) for all reads — simple, typed, no manual column selection
- **SQL-like API** (`db.select().from()`) for lists, aggregates, and anything needing dynamic conditions
- **Direct column access** instead of traversing property graphs
- **Inline filter conditions** as `SQL[]` arrays — no registry pattern needed unless complexity warrants it

---

## Local Setup

**Prerequisites:** PostgreSQL running. The existing `docker-compose.yml` covers this.

```bash
# 1. Install dependencies
yarn install

# 2. Set DATABASE=postgres in .env.local (already set on this branch)
# Your .env.local needs:
#   DATABASE=postgres
#   POSTGRES_URL=postgresql://postgres:postgres@localhost:5432/cord

# 3. Start the server — migrations run automatically on startup
yarn start:dev
```

When `DATABASE=postgres`, `DrizzleMigrator` runs on `onModuleInit` and creates the `field_zones` and `field_regions` tables.

---

## Authenticating in Apollo

The API requires a session token. In Apollo Sandbox or Studio:

**Step 1** — Get a token (no auth header needed):
```graphql
{ session { token } }
```

**Step 2** — Add the token to Apollo's Headers panel:
```
Authorization: Bearer <token from step 1>
```

**Step 3** — Login:
```graphql
mutation {
  login(input: { email: "devops@tsco.org", password: "admin" }) {
    user { id }
  }
}
```

All subsequent queries and mutations now go through PostgreSQL for FieldZone and FieldRegion.

---

## File Inventory

### Infrastructure

| File | Purpose |
|---|---|
| `src/core/database/drizzle/schema.ts` | Table definitions (`pgTable`) — the single source of truth for DB shape |
| `src/core/database/drizzle/drizzle.service.ts` | NestJS injectable wrapping `drizzle(pool, { schema })` |
| `src/core/database/drizzle/migrator.ts` | Runs migrations on app startup when `DATABASE=postgres` |
| `src/core/database/drizzle/drizzle.module.ts` | `@Global()` NestJS module — exports `DrizzleService` everywhere |
| `src/core/database/drizzle/migrations/` | SQL migration files managed by drizzle-kit |
| `drizzle.config.ts` | Config for `yarn drizzle-kit generate` / `push` CLI commands |

### Domain

| File | Purpose |
|---|---|
| `src/components/field-zone/field-zone.drizzle.repository.ts` | FieldZone CRUD via Drizzle |
| `src/components/field-region/field-region.drizzle.repository.ts` | FieldRegion CRUD via Drizzle |

### Modified Files

| File | Change |
|---|---|
| `src/core/config/config.service.ts` | Added `postgresUrl` env var |
| `src/core/database/split-db.provider.ts` | Added `'postgres'` to `DatabaseEngines` union type |
| `src/core/core.module.ts` | Added `DrizzleModule` to imports |
| `src/components/field-zone/field-zone.module.ts` | Wired `postgres: FieldZoneDrizzleRepository` into `splitDb()` |
| `src/components/field-region/field-region.module.ts` | Wired `postgres: FieldRegionDrizzleRepository` into `splitDb()` |
| `nest-cli.json` | Added `assets` config to copy migration files to `dist/` |

---

## Architecture: How the Pieces Fit Together

```
GraphQL Request
     │
     ▼
  Resolver
     │
     ▼
  Service  ◄── privileges (auth checks)
     │
     ▼
splitDb()  ────► neo4j (default)
     │      ────► gel  (DATABASE=gel)
     └──────────► postgres  (DATABASE=postgres) ◄── DrizzleRepository
                                                         │
                                                    DrizzleService
                                                         │
                                                    PostgreSQL
```

`splitDb()` is a NestJS provider factory that reads `config.databaseEngine` at startup and resolves the right repository class. All three database paths implement the same public interface, so the service layer is unchanged.

---

## The Schema File

`src/core/database/drizzle/schema.ts` is the single source of truth for table shape. It replaces the Neo4j property-node pattern with plain columns.

```typescript
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

import { relations } from 'drizzle-orm';
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const fieldZones = pgTable('field_zones', {
  id:          text('id').primaryKey(),
  name:        text('name').notNull().unique(),
  director_id: text('director_id'),
  created_at:  timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at:  timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const fieldRegions = pgTable('field_regions', {
  id:            text('id').primaryKey(),
  name:          text('name').notNull().unique(),
  director_id:   text('director_id'),
  field_zone_id: text('field_zone_id').notNull().references(() => fieldZones.id),
  created_at:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at:    timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Relations enable the Relational API (db.query.X.findFirst/findMany)
export const fieldZonesRelations = relations(fieldZones, ({ many }) => ({
  regions: many(fieldRegions),
}));

export const fieldRegionsRelations = relations(fieldRegions, ({ one }) => ({
  zone: one(fieldZones, {
    fields:     [fieldRegions.field_zone_id],
    references: [fieldZones.id],
  }),
}));
```

**Why `text` for IDs?** The app uses nanoid (11-char alphanumeric strings), not UUIDs. Using `text` keeps it consistent with the existing ID system.

**Why no `$defaultFn` for the ID?** `generateId()` is async; Drizzle's `$defaultFn` is synchronous. IDs are generated in the repository's `create()` method instead.

**Why `relations()`?** The Relational API (`db.query.X`) requires explicit `relations()` declarations. They must also be passed in the `drizzle(pool, { schema })` call in `DrizzleService`. Without both, `db.query` silently returns `undefined`.

---

## The Two Drizzle APIs

Drizzle ships **two completely different ways** to query the same database. You can use both in the same project, even the same repository.

### API 1: SQL-like (Core) — `db.select().from().where()`

This API maps directly to SQL constructs and gives full control over the query. It's the right choice for lists, aggregates, and dynamic conditions.

```typescript
// Simple select
const rows = await db.select().from(fieldZones).where(eq(fieldZones.id, id));

// With join
const rows = await db
  .select({ zone: fieldZones, region: fieldRegions })
  .from(fieldZones)
  .leftJoin(fieldRegions, eq(fieldRegions.field_zone_id, fieldZones.id))
  .where(eq(fieldZones.id, zoneId));

// Insert + returning
const [row] = await db.insert(fieldZones).values({ id, name }).returning();

// Update
await db.update(fieldZones).set({ name: 'New Name' }).where(eq(fieldZones.id, id));

// Delete
await db.delete(fieldZones).where(eq(fieldZones.id, id));

// Aggregate
const [{ count }] = await db
  .select({ count: sql<number>`count(*)::int` })
  .from(fieldRegions)
  .where(eq(fieldRegions.field_zone_id, zoneId));
```

**Use this when:**
- Building list queries with pagination and sorting
- You need aggregates (`count`, `sum`, `avg`)
- You need CTEs or window functions
- You need raw SQL fragments (`sql` tag)
- Queries involve dynamic conditions assembled at runtime (auth filtering, list filters)
- All writes (insert, update, delete)

---

### API 2: Relational — `db.query.tableName.findMany({ with: { ... } })`

The Relational API is an ORM-style layer built on top of the SQL-like API. It lets you declare relationships in the schema and then load nested objects without writing joins.

**Step 1 — Declare relations in the schema:**

```typescript
// schema.ts
import { relations } from 'drizzle-orm';

export const fieldZonesRelations = relations(fieldZones, ({ many }) => ({
  regions: many(fieldRegions),
}));

export const fieldRegionsRelations = relations(fieldRegions, ({ one }) => ({
  zone: one(fieldZones, {
    fields:     [fieldRegions.field_zone_id],
    references: [fieldZones.id],
  }),
}));
```

**Step 2 — Query with `db.query`:**

```typescript
// Load a zone and all its regions in one call
const zone = await db.query.fieldZones.findFirst({
  where: eq(fieldZones.id, id),
  with: {
    regions: true,          // loads all related regions
  },
});
// Result: { id, name, director_id, regions: [{ id, name, ... }, ...] }

// Load a region with its zone inline
const region = await db.query.fieldRegions.findFirst({
  where: eq(fieldRegions.id, id),
  with: {
    zone: {
      columns: { id: true, name: true },  // select only these columns
    },
  },
});

// Deeply nested
const zone = await db.query.fieldZones.findFirst({
  where: eq(fieldZones.id, id),
  with: {
    regions: {
      with: {
        // hypothetical: regions with their projects
        projects: true,
      },
    },
  },
});
```

**Use this when:**
- Loading a single resource by ID (`readOne`, `readMany`)
- You need to include related sub-objects (e.g. a region with its zone)
- The query doesn't require aggregation or dynamic runtime conditions
- You want readable code that mirrors the data shape rather than raw SQL

This is the **primary API for read operations** in this pilot.

**What it does under the hood:** Drizzle's relational API does NOT generate a single SQL JOIN. It runs a separate `SELECT` for each related table and merges the results in memory. This avoids the row-multiplication problem you get with joins on one-to-many relations (a zone with 50 regions returns 50 rows with a join; Drizzle runs two clean queries and merges). This is sometimes called "batched loading."

---

### Summary: Which API for What

| Scenario | Use |
|---|---|
| `readOne(id)` / `readMany(ids)` | **Relational** — less boilerplate, typed automatically |
| Load a resource with related sub-objects | **Relational** — `with: { zone: true }` |
| List queries with pagination, sorting, filters | **SQL-like** — dynamic conditions compose as `SQL[]` |
| Aggregates, counts, sums | **SQL-like** — relational API can't do aggregates |
| All writes (insert, update, delete) | **SQL-like** — relational API is read-only |
| CTEs, window functions, `DISTINCT ON` | **SQL-like** |
| Raw SQL fragments | **SQL-like** with the `sql` tag |
| Changeset JSONB merge | **SQL-like** with `sql` tag (single query, no round-trip) |

Both APIs are typed. Both work against the same connection pool. You can mix them freely within a single repository.

---

## Migrations

Drizzle-kit manages schema changes. The workflow:

```bash
# After changing schema.ts — generate a new SQL migration file
POSTGRES_URL=postgresql://postgres:postgres@localhost:5432/cord \
  yarn drizzle-kit generate

# Or push changes directly to the dev DB (skips migration files — dev only)
POSTGRES_URL=postgresql://postgres:postgres@localhost:5432/cord \
  yarn drizzle-kit push

# Inspect the current DB schema
POSTGRES_URL=postgresql://postgres:postgres@localhost:5432/cord \
  yarn drizzle-kit studio
```

Generated migration files live in `src/core/database/drizzle/migrations/`. They are SQL files tracked in git. The migrator applies them automatically on server startup when `DATABASE=postgres`.

---

## The Project Domain — What It Would Look Like

Project is the most complex domain in the app. It illustrates the harder problems: polymorphic subtypes, changeset draft/publish, auth-injected WHERE clauses, computed fields, and multiple related entities. Here's how it ports to Drizzle.

### Schema

```typescript
// src/core/database/drizzle/schema.ts (additions)
import { pgTable, text, boolean, date, timestamp, jsonb, unique } from 'drizzle-orm/pg-core';

export const projects = pgTable('projects', {
  id:                    text('id').primaryKey(),
  // Discriminator for MomentumTranslation / MultiplicationTranslation / Internship
  type:                  text('type').notNull(),
  name:                  text('name').notNull().unique(),
  department_id:         text('department_id').unique(),
  step:                  text('step').notNull().default('EarlyConversations'),
  // For Translation projects, sensitivity is denormalized from connected languages
  sensitivity:           text('sensitivity').notNull().default('High'),
  mou_start:             date('mou_start'),
  mou_end:               date('mou_end'),
  initial_mou_end:       date('initial_mou_end'),
  estimated_submission:  date('estimated_submission'),
  preset_inventory:      boolean('preset_inventory').notNull().default(false),
  primary_location_id:   text('primary_location_id'),
  field_region_id:       text('field_region_id').references(() => fieldRegions.id),
  root_directory_id:     text('root_directory_id'),
  owning_organization_id: text('owning_organization_id'),
  created_at:            timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at:            timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Draft/publish overlay — fields in `changes` JSONB override the base row
export const projectChangesetOverrides = pgTable('project_changeset_overrides', {
  id:           text('id').primaryKey(),
  project_id:   text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  changeset_id: text('changeset_id').notNull(),
  changes:      jsonb('changes').notNull(),
}, (t) => [unique().on(t.project_id, t.changeset_id)]);

export const projectMembers = pgTable('project_members', {
  id:          text('id').primaryKey(),
  project_id:  text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  user_id:     text('user_id').notNull(),
  roles:       text('roles').array().notNull().default([]),
  inactive_at: timestamp('inactive_at', { withTimezone: true }),
  created_at:  timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
```

### Relations (for Relational API)

```typescript
// schema.ts
export const projectsRelations = relations(projects, ({ many }) => ({
  members:      many(projectMembers),
  changesets:   many(projectChangesetOverrides),
}));

export const projectMembersRelations = relations(projectMembers, ({ one }) => ({
  project: one(projects, { fields: [projectMembers.project_id], references: [projects.id] }),
}));
```

### Repository

Project needs the SQL-like API for both `readMany` and `list` — it has changeset overrides (JSONB merge), correlated subqueries for membership and engagement count, and dynamic filter conditions. Relational API can't do any of that.

```typescript
@Injectable()
export class ProjectDrizzleRepository {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly identity: Identity,
  ) {}

  readonly getActualChanges = getChanges(Project);

  // ── readMany: SQL-like API ────────────────────────────────────────────────
  // Uses correlated subqueries for per-row related data — avoids join row
  // multiplication that would occur if we joined on project_members or engagements.
  // Changeset JSONB merge happens inside the SELECT — single query, no round-trip.
  async readMany(ids: readonly ID[], changesetId?: ID): Promise<UnsecuredDto<Project>[]> {
    const userId = this.identity.current.id;

    // COALESCE: if a changeset override exists for this field, use it; otherwise use the base column.
    const coalesce = (field: string) =>
      changesetId
        ? sql<string>`COALESCE(
            (SELECT (changes->>${sql.raw(`'${field}'`)})::text
             FROM project_changeset_overrides
             WHERE project_id = ${projects.id} AND changeset_id = ${changesetId}),
            ${sql.identifier(field)}
          )`
        : sql.identifier(field);

    const rows = await this.drizzle.db
      .select({
        id:          projects.id,
        type:        projects.type,
        name:        coalesce('name'),
        step:        coalesce('step'),
        sensitivity: projects.sensitivity,
        created_at:  projects.created_at,
        // Membership: correlated subquery, one result per project row
        membership: sql`(
          SELECT json_build_object('id', pm.id, 'roles', pm.roles)
          FROM project_members pm
          WHERE pm.project_id = ${projects.id}
            AND pm.user_id = ${userId}
            AND pm.inactive_at IS NULL
          LIMIT 1
        )`,
        // Engagement count: scalar subquery
        engagement_total: sql<number>`(
          SELECT count(*)::int FROM engagements e WHERE e.project_id = ${projects.id}
        )`,
      })
      .from(projects)
      .where(inArray(projects.id, [...ids]));

    return rows.map((r) => ({
      id:              r.id as ID,
      createdAt:       DateTime.fromJSDate(r.created_at),
      name:            r.name,
      step:            r.step as ProjectStep,
      // status is derived from step — not stored in DB
      status:          stepToStatus(r.step as ProjectStep),
      sensitivity:     r.sensitivity as Sensitivity,
      type:            r.type as ProjectType,
      membership:      r.membership as ProjectMembership | null,
      engagementTotal: r.engagement_total ?? 0,
    }));
  }

  // ── list: SQL-like API ────────────────────────────────────────────────────
  // Dynamic filter conditions + auth conditions are collected as SQL[] and
  // merged at the call site. Straightforward, no builder pattern needed.
  async list(input: ProjectListInput) {
    const { count, page, sort, order, filter } = input;
    const offset = (page - 1) * count;

    const conditions = [
      ...buildProjectFilterConditions(filter),
      // TODO: port privileges.filterToReadable() to emit SQL[] conditions
      // This is the gating work for Phase 1 of the full migration.
    ].filter(Boolean);
    const where = conditions.length ? and(...conditions) : undefined;

    const orderBy = sort === 'name'
      ? order === 'ASC' ? asc(projects.name) : desc(projects.name)
      : order === 'ASC' ? asc(projects.created_at) : desc(projects.created_at);

    const [rows, countRows] = await Promise.all([
      this.drizzle.db.select().from(projects).where(where).orderBy(orderBy).limit(count).offset(offset),
      this.drizzle.db.select({ total: sql<number>`count(*)::int` }).from(projects).where(where),
    ]);

    const total = countRows[0]?.total ?? 0;
    return {
      items: rows.map((r) => this.toDto(r)),
      total,
      hasMore: offset + rows.length < total,
    };
  }

  // ── readOne: Relational API ───────────────────────────────────────────────
  // Simple ID lookup with no changeset merge or aggregation — Relational API
  // is the right call here. No manual column selection, typed automatically.
  async readOne(id: ID) {
    const row = await this.drizzle.db.query.projects.findFirst({
      where: (t, { eq: e }) => e(t.id, id),
    });
    if (!row) throw new NotFoundException('Could not find project');
    return this.toDto(row);
  }

  private toDto(row: typeof projects.$inferSelect): UnsecuredDto<Project> {
    return {
      id:          row.id as ID,
      createdAt:   DateTime.fromJSDate(row.created_at),
      type:        row.type as ProjectType,
      name:        row.name,
      step:        row.step as ProjectStep,
      status:      stepToStatus(row.step as ProjectStep),
      sensitivity: row.sensitivity as Sensitivity,
      fieldRegion: row.field_region_id
        ? { id: row.field_region_id as ID<'FieldRegion'> }
        : undefined,
    };
  }
}
```

### Filters

Drizzle filters are plain arrays of `SQL` conditions. They compose by spreading arrays together:

```typescript
// src/components/project/project.drizzle.filters.ts
export function buildProjectFilterConditions(filter?: ProjectFilters): SQL[] {
  const conditions: SQL[] = [];
  if (!filter) return conditions;

  if (filter.type?.length) {
    conditions.push(inArray(projects.type, filter.type));
  }

  if (filter.step?.length) {
    conditions.push(inArray(projects.step, filter.step));
  }

  if (filter.languageId) {
    conditions.push(
      exists(
        db.select().from(engagements)
          .where(and(
            eq(engagements.project_id, projects.id),
            eq(engagements.type, 'LanguageEngagement'),
            eq(engagements.language_id, filter.languageId),
          ))
      )
    );
  }

  if (filter.userId) {
    conditions.push(
      or(
        exists(db.select().from(projectMembers).where(and(
          eq(projectMembers.project_id, projects.id),
          eq(projectMembers.user_id, filter.userId),
        ))),
        exists(db.select().from(engagements).where(and(
          eq(engagements.project_id, projects.id),
          eq(engagements.intern_id, filter.userId),
        ))),
      )!
    );
  }

  if (filter.name) {
    // Full-text search via tsvector
    conditions.push(
      sql`to_tsvector('english', ${projects.name}) @@ plainto_tsquery(${filter.name})`
    );
  }

  return conditions;
}

// Sub-filters compose by adding conditions scoped to a joined table.
// This replaces the Neo4j filter.sub() pattern.
export function buildFieldRegionFilterConditions(
  filter?: FieldRegionFilters,
  table = fieldRegions,
): SQL[] {
  // ... conditions against `table.*`
  return [];
}
```

---

## Drizzle vs Kysely: Key Differences

Both libraries target the same use case. Here is what stood out building both pilots:

### Migration tooling

Drizzle ships `drizzle-kit` — a first-class CLI that inspects your TypeScript schema and generates SQL migration files automatically. You change `schema.ts`, run `yarn drizzle-kit generate`, and get a SQL diff. Kysely has no equivalent; you write migration files by hand.

**Winner for migrations: Drizzle**

### Query composition

Kysely's `ExpressionBuilder` (used via `.$call()`) is chainable: a composable function receives the builder and returns a modified builder. This maps cleanly to the existing Neo4j `hydrate()` and `filter.define()` patterns.

Drizzle's SQL-like API is not chainable in the same way — conditions are collected as `SQL[]` arrays and merged at the call site. This is simpler to read but loses the neat sub-filter delegation that Kysely enables.

```typescript
// Kysely — composable, builder threads through
.select(eb => this.hydrate(eb, changesetId))
.apply(projectFilters(input.filter))
.apply(this.privileges.for(IProject).filterToReadable())

// Drizzle — conditions collected as arrays, assembled at call site
const conditions = [
  ...buildProjectFilterConditions(input.filter),
  ...this.buildAuthConditions(),
];
.where(and(...conditions))
```

**Winner for query composition: Kysely**

### Join vs correlated subquery

The `hydrate()` pattern in Neo4j uses correlated subqueries (one per related field). Drizzle's SQL-like API supports both joins and subqueries, but its Relational API uses batched separate queries rather than correlated subqueries. Kysely's ExpressionBuilder makes correlated subqueries first-class. For the Project domain's `membership`, `engagement_total`, and `primaryPartnership` fields, both work — the syntax differs.

### Relational API (Drizzle only)

Drizzle's Relational API has no Kysely equivalent. For loading a resource with nested children (e.g. a FieldZone with all its FieldRegions), it's the cleanest option in Drizzle. Kysely requires explicit subquery selects for the same result.

### Schema definition

Both use TypeScript. Drizzle's schema is `pgTable()` calls; Kysely's is plain TypeScript interfaces. Drizzle's is slightly more verbose but drives `drizzle-kit` migrations automatically, which is a significant practical advantage.

---

## What's Stubbed / Not Yet Done

- **Auth filter injection** — `buildAuthConditions()` returns an empty array. The full migration requires porting `privileges.filterToReadable()` to emit Drizzle `SQL[]` conditions. This is Phase 1 gating work before any domain can be fully production-safe.
- **Sub-filters** — `director` and `fieldZone` filter fields in the pilot repos have TODO comments. These require a helper analogous to Neo4j's `filter.sub()`.
- **`filter.define()` pattern** — the declarative filter registry from the Neo4j layer doesn't exist yet. Filters are currently plain functions returning `SQL[]`. This can be wrapped in a helper later.
- **Changeset JSONB merge** — shown in the Project example above but not in the pilot domains (FieldZone and FieldRegion don't participate in changesets).
- **E2E tests** — `test/zone.e2e-spec.ts` and `test/region.e2e-spec.ts` run against Neo4j. A postgres variant needs wiring.
- **`splitDb()` `as any` cast** — the type system expects `PublicOf<NeoRepository>`, which includes Neo4j base class members. The Drizzle repos don't extend that base, so a narrow cast is needed. A proper interface extraction would fix this cleanly.

---

## Gotchas Encountered

**`migrate()` path resolution** — Drizzle's `migrate()` looks for `meta/_journal.json` relative to the path you pass. NestJS compiles TypeScript to `dist/` and runs from there, so `import.meta.url` resolves inside `dist/`. We use `process.cwd()` instead, which always resolves to the project root in dev:

```typescript
// This works in dev mode (project root = process.cwd())
const migrationsFolder = path.join(process.cwd(), 'src/core/database/drizzle/migrations');
```

For production you'd want to ship migration files alongside the compiled output (via `nest-cli.json` `assets` config, which is also set on this branch) and switch to a path relative to `import.meta.url`.

**`canDelete` is not in `UnsecuredDto<T>`** — The `UnsecuredDto` type strips `Secured<>` wrappers and also excludes `canDelete`. Don't include it in `toDto()` return objects — TypeScript will complain.

**`inArray` with spread** — Drizzle's `inArray` requires a plain mutable array, not a `readonly` one. Use `inArray(table.id, [...ids])` to spread the readonly array.

**`ILogger.log()` requires `LogLevel` first** — The app's logger interface does not match NestJS's built-in `Logger`. Use `this.logger.info(msg)` or `this.logger.error(msg)` — not `.log(msg)`.

**Director role validation hits Neo4j** — `FieldZoneService.validateDirectorRole()` calls `UserService.readOneUnsecured()`, which reads from Neo4j. User is not yet migrated to PostgreSQL. This is expected for the pilot.
