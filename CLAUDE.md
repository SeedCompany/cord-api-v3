# CLAUDE.md — CORD API v3

## Project Summary

CORD API v3 is a **Bible translation project management API** built with NestJS + TypeScript. It is 100% GraphQL (code-first, no REST). The database is **PostgreSQL**, accessed through **Drizzle**. Production moved to Postgres from Neo4j in September 2026; the Neo4j and Gel code is gone.

---

## Tech Stack

| Layer           | Choice                                                               |
| --------------- | -------------------------------------------------------------------- |
| Framework       | NestJS v11 (Fastify adapter — not Express)                           |
| Language        | TypeScript v5 (`type: "module"`, strict mode, ESM)                   |
| API             | GraphQL Yoga, `@nestjs/graphql` code-first, graphql-ws subscriptions |
| Database        | PostgreSQL 16 via Drizzle ORM (`drizzle-orm`, `pg`)                  |
| Queues          | BullMQ + Redis                                                       |
| Auth            | JWT + argon2                                                         |
| File storage    | AWS S3                                                               |
| Package manager | Yarn v4 (Berry) — use `yarn`, never `npm`                            |
| Node            | >= 24                                                                |
| Testing         | Jest 30 + `ts-jest`, ephemeral Postgres database per test file       |

---

## Directory Layout

```
src/
  app.module.ts          # Root module
  main.ts                # Bootstrap
  components/            # Feature modules
  core/                  # Global infrastructure
    authentication/      # JWT, session, guards
    config/              # ConfigService (dotenv)
    data-loader/         # DataLoader batching base classes
    database/            # TransactionRunner, @Transactional(), transaction hooks
    drizzle/             # DrizzleService, schema, migrations, repository base, order-by helpers
    hooks/               # Internal event bus (re-export from @seedcompany/nest/hooks)
    queue/               # BullMQ setup
    resources/           # Resource registry, @RegisterResource, ResourceMap, BaseNode
  common/                # Shared types, decorators, scalars, validators
test/
  setup/                 # createApp(), ephemeral Postgres, faker patches, shard sequencer
  utility/               # createTestApp() and entity fixture helpers
  operations/            # Shared GraphQL operations for tests
  *.e2e-spec.ts          # E2E test files (primary test pattern)
```

### Feature module anatomy

```
src/components/{entity}/
  {entity}.module.ts
  {entity}.resolver.ts
  {entity}.service.ts
  {entity}.repository.ts          # Drizzle repository
  {entity}.loader.ts              # DataLoader
  dto/
    index.ts                      # barrel export
    {entity}.dto.ts               # @ObjectType DTO
    create-{entity}.dto.ts        # @InputType
    update-{entity}.dto.ts        # @InputType
    list-{entity}.dto.ts          # pagination input/output
  hooks/                          # event bus hooks
  handlers/                       # @OnHook handlers
```

---

## Architecture: How a Request Flows

```
GraphQL request
  → Resolver (@Loader injection)
  → DataLoader batches → service.readMany(ids)
  → service calls repo.readMany()
  → list reads apply the read policy as SQL   ← PolicyExecutor.applyReadFilter (not automatic)
  → repo builds the DTO from rows             ← toDto()
  → repo applies input filters / sorting      ← resolveOrderBy, SortMap
  → service calls privileges.secure(dto)      ← wraps fields in { value, canRead, canEdit }
  → resolver returns secured DTO to GraphQL

Mutations run in one transaction (DrizzleTransactionalMutationsInterceptor).
Hooks fire inside that transaction — sequential, awaited.
```

---

## Key Patterns

### DTOs

```typescript
@RegisterResource()
@ObjectType({ implements: Interfaces.members })
export class Partnership extends Interfaces {
  static readonly Relations = (() => ({
    ...Resource.Relations(),
    organization: Organization,
  })) satisfies ResourceRelationsShape;

  @Field()
  readonly primary: SecuredBoolean; // access-controlled field

  @Calculated() // computed, not stored
  @Field()
  readonly mouStart: SecuredDateNullable;
}

// Always declare the resource in ResourceMap via module augmentation:
declare module '~/core/resources/map' {
  interface ResourceMap {
    Partnership: typeof Partnership;
  }
}
```

- Most DTO fields are `Secured<T>` wrappers (`SecuredString`, `SecuredBoolean`, etc.)
- `@Calculated()` marks fields that are computed at the resolver/service layer
- Extend `Resource` (or `IntersectTypes(Resource, ...)`) as the base class
- Register `Relations` as a static thunk returning a plain object

### Resolvers

```typescript
@Resolver(() => User)
export class UserResolver {
  @Query(() => User)
  async user(@IdArg() id: ID): Promise<User> {}

  @Mutation(() => CreateUserOutput)
  async createUser(@Args() input: CreatePerson): Promise<CreateUserOutput> {}

  @ResolveField(() => String, { nullable: true })
  fullName(@Parent() user: User): string | undefined {}
}
```

- Use `@IdArg()` for single ID arguments (not raw `@Args('id')`)
- `@ResolveField()` for computed/derived fields
- Inject services via constructor, never call repositories directly from resolvers

### Services

- Services handle business logic, auth checks, and orchestration
- Delegate all persistence to repositories
- Fire hooks via `Hooks` injection after mutations
- Use `Privileges` for `secure(dto)` and permission checks

### Repositories

- Extend `DrizzleDtoRepository` from `~/core/drizzle` and implement `toDto(row)`
- Tables come from `~/core/drizzle/schema`; query with `this.db` (transaction-aware)
- Writes through `this.updateColumns()` / `this.softDelete()` invalidate the live-query store; a repository that hand-rolls writes must call `liveQueryStore.invalidate(...)` itself (the `live-query-invalidation.spec.ts` unit test enforces this)
- List reads should call `PolicyExecutor.applyReadFilter` so rows the requester can't read never leave the database — the base class does not do it for you (the base `readMany` filters only by id and liveness)
- Sort user-chosen keys with the `~/core/drizzle` order-by helpers (`resolveOrderBy`, `orderEntry`) so text sorts are collated and blanks sort last
- Return `UnsecuredDto<T>` (never apply security in the repo)

### Hooks (internal event bus)

```typescript
// Hook definition
export class UserUpdatedHook {
  user: User;
}

// Handler — @OnHook runs in the same DB transaction
@OnHook(UserUpdatedHook)
class SomeHandler {
  handle(event: UserUpdatedHook) {
    /* mutate event fields if needed */
  }
}
```

- Hooks are sequential and awaited within the triggering transaction
- Handlers may mutate the hook object; subsequent handlers see the update
- Lower priority number = runs first (default 0)

### Authorization

- `@RegisterResource` makes a DTO policy-aware
- `PolicyExecutor.applyReadFilter` adds the read policy to a query's WHERE clause (each condition's `asDrizzleCondition`)
- `privileges.secure(unsecuredDto)` wraps each field in `{ value, canRead, canEdit }`
- Policies are defined in `src/components/authorization/policies/`
- Conditions are in `src/components/authorization/policy/conditions/`

---

## Database

- Schema: `src/core/drizzle/schema`
- Migrations: hand-written SQL in `src/core/drizzle/migrations`, each with an entry in `migrations/meta/_journal.json`; `DrizzleMigrator` applies them at boot
- **Don't run `yarn migrate:generate`** — there are no drizzle-kit snapshots, so it emits the whole schema
- Drizzle skips a journal entry whose `when` is not later than the newest one a database has applied, so a new entry's `when` must be later than every existing one
- Soft-delete tables use `deleted_at`; uniqueness is a partial unique index `… WHERE deleted_at IS NULL`, never an inline UNIQUE

---

## Testing

**Primary pattern is E2E.** Unit tests exist but E2E tests are the main coverage vehicle.

```bash
yarn test          # unit tests
export POSTGRES_URL='postgresql://postgres:postgres@localhost:5432/cord?sslmode=no-verify'
yarn test:e2e      # e2e tests (full NestJS app + ephemeral Postgres database per file)
yarn test:e2e --testPathPatterns=<pattern>   # one spec
```

- E2E tests live in `test/*.e2e-spec.ts`
- `POSTGRES_URL` must be a real environment variable — the per-file database is created before the app (and dotenv) loads
- Use `createApp()` from `test/setup/create-app.ts` (or `createTestApp()` from `test/utility`) — do not bootstrap the app manually
- Use faker helpers from `test/operations/` for creating entities
- **Do NOT use `jest.unstable_mockModule`** in any spec file — it causes "import after environment torn down" errors across the entire test suite (ESM contamination)
- When creating language engagements in tests, always set `startDateOverride` and `endDateOverride` to match the project's MOU window, not `DateTime.now()` — otherwise progress reports won't exist for the expected fiscal quarter

---

## Commands

```bash
# Development
yarn start:dev          # dev server with hot reload
yarn start:debug        # debug mode
yarn start -- --gen-schema   # write schema.graphql and exit (no database needed)

# Build
yarn build              # compile to dist/
yarn start:prod         # run compiled output

# Code quality
yarn lint               # ESLint --fix, fails on any warning (--max-warnings 0)
yarn type-check         # tsc check only (no emit)

# Tests
yarn test               # unit (Jest, Unit project)
yarn test:e2e           # e2e (Jest, E2E project)

# Utilities
yarn clean              # remove dist, schema.graphql
yarn repl               # TypeScript REPL with app context
yarn console -- [cmd]   # CLI commands
```

---

## Code Conventions

- **File naming:** kebab-case, `{entity}.{role}.ts` — e.g. `user.service.ts`, `user.repository.ts`
- **Barrel exports:** each `dto/` folder has an `index.ts` that re-exports everything
- **Path aliases:** use `~/` for `src/` (e.g., `import { ID } from '~/common'`), not relative imports across modules
- **No `any`:** TypeScript strict mode. Use `unknown` and narrow.
- **ESM:** the project is `"type": "module"`. All imports must have explicit `.js` extensions for relative paths (TypeScript resolves via `extensionless`).
- **Linting:** `yarn lint` must pass with zero warnings before committing. Husky pre-commit runs lint-staged automatically.
- **No REST:** everything is GraphQL. Do not add HTTP controllers or Express-style routes.
- **No direct DB in resolvers:** resolvers call services; services call repositories.
- **`UnsecuredDto<T>`**: repositories always return this type; services call `privileges.secure()` before returning to resolvers.

---

## Important Gotchas

1. **CI boots the app with no database** (`--gen-schema` runs first in every job). Anything that touches the database at boot must skip when `config.isGenSchema` is set.
2. **`status` on projects is a GENERATED column** — derived from `step`. Never write to it directly.
3. **Changesets were not carried forward.** The GraphQL surface (`changeset` args, `Project.changeRequests`) stays because the web app selects it, but nothing stores changesets.
4. **Hooks run inside the triggering transaction** — if a hook handler throws, the entire operation rolls back. Work that must happen only after commit goes through `TransactionHooks.afterCommitOrNow(fn)`: inside a GraphQL mutation it waits for the commit, anywhere else it runs right away. Plain `afterCommit` is only drained for mutations.
5. **`TransactionRetryInformer.markForRetry`** re-runs the whole transaction, so a handler that uses it must be idempotent.
6. **Non-unique sorts tie on the random `id`**, so give list sorts a meaningful tiebreaker when order matters.
7. **`@seedcompany/*` packages** are internal — `@seedcompany/nest`, `@seedcompany/common`, `@seedcompany/data-loader`, etc. Check their source in `node_modules` if docs are sparse.
