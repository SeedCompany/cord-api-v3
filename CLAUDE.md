# CLAUDE.md — CORD API v3

## Project Summary

CORD API v3 is a **Bible translation project management API** built with NestJS + TypeScript. It is 100% GraphQL (code-first, no REST). The project is actively migrating its primary database from Neo4j to **Gel** (a next-generation graph database formerly known as EdgeDB).

---

## Tech Stack

| Layer            | Choice                                                               |
| ---------------- | -------------------------------------------------------------------- |
| Framework        | NestJS v11 (Fastify adapter — not Express)                           |
| Language         | TypeScript v5 (`type: "module"`, strict mode, ESM)                   |
| API              | GraphQL Yoga, `@nestjs/graphql` code-first, graphql-ws subscriptions |
| Primary DB (new) | Gel v2 (`gel`, `@gel/generate`)                                      |
| Legacy DB        | Neo4j (`neo4j-driver`, `cypher-query-builder`)                       |
| Queues           | BullMQ + Redis                                                       |
| Auth             | JWT + argon2                                                         |
| File storage     | AWS S3                                                               |
| Package manager  | Yarn v4 (Berry) — use `yarn`, never `npm`                            |
| Node             | >= 24                                                                |
| Testing          | Jest 30 + `ts-jest`, ephemeral Gel DB per test file                  |

---

## Directory Layout

```
src/
  app.module.ts          # Root module
  main.ts                # Bootstrap
  components/            # 45+ feature modules (see below)
  core/                  # Global infrastructure
    authentication/      # JWT, session, guards
    authorization/       # RBAC, policy engine, conditions
    config/              # ConfigService (dotenv)
    data-loader/         # DataLoader batching base classes
    gel/                 # Gel DB client, generated types, seeding
    hooks/               # Internal event bus (re-export from @seedcompany/nest/hooks)
    neo4j/               # Legacy Neo4j module (being phased out)
    queue/               # BullMQ setup
    resources/           # Resource registry, @RegisterResource, ResourceMap
  common/                # Shared types, decorators, scalars, validators
test/
  setup/                 # createApp(), ephemeralGel(), faker patches
  *.e2e-spec.ts          # E2E test files (primary test pattern)
  operations/            # Shared GraphQL operations for tests
dbschema/                # Gel schema (.gel files, 30 domains)
```

### Feature module anatomy

```
src/components/{entity}/
  {entity}.module.ts
  {entity}.resolver.ts
  {entity}.service.ts
  {entity}.repository.ts          # Neo4j (legacy)
  {entity}.gel.repository.ts      # Gel (new)
  {entity}.loader.ts              # DataLoader
  dto/
    index.ts                      # barrel export
    {entity}.dto.ts               # @ObjectType DTO
    create-{entity}.dto.ts        # @InputType
    update-{entity}.dto.ts        # @InputType
    list-{entity}.dto.ts          # pagination input/output
  hooks/                          # event bus hooks
  migrations/                     # application/data transformation migrations
                                  # (src/components/*/migrations/); DB schema
                                  # migrations are generated under dbschema/migrations/
```

---

## Architecture: How a Request Flows

```
GraphQL request
  → Resolver (@Loader injection)
  → DataLoader batches → service.readMany(ids, view)
  → service calls repo.readMany()
      splitDb() routes: if Gel repo exists, use it; else fall back to Neo4j
  → repo applies privileges.filterToReadable()  ← auth WHERE clause injection
  → repo applies hydrate()                       ← assembles full DTO
  → repo applies input filters                   ← filter.define() / SQL conditions
  → service calls privileges.secure(dto)         ← wraps fields in { value, canRead, canEdit }
  → resolver returns secured DTO to GraphQL

Mutations fire Hooks in the same DB transaction — sequential, awaited.
Everything above the repository is DB-agnostic; splitDb() is the migration boundary.
```

---

## Database Migration Status

**Current state:** Neo4j is still the primary database. Gel repositories are being built domain-by-domain. `splitDb()` routes each domain to whichever implementation is ready.

- `*.repository.ts` — Neo4j implementation (cypher-query-builder)
- `*.gel.repository.ts` — Gel implementation (EdgeQL, generated client)
- `splitDb(EntityRepository, { gel: EntityGelRepository })` — the routing provider

**Do not remove Neo4j repositories** until a domain's Gel repository is fully built and validated.

**Next phase (planning):** A subsequent migration from Gel to PostgreSQL (Kysely vs Drizzle) is under evaluation. Planning docs have not yet been committed to this repository — ask the team for access. Do not start this work without explicit instruction.

---

## Key Patterns

### DTOs

```typescript
@RegisterResource({ db: e.Partnership })
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

// Always declare resource in ResourceMap via module augmentation:
declare module '~/core/resources/map' {
  interface ResourceMap {
    Partnership: typeof Partnership;
  }
  interface ResourceDBMap {
    Partnership: typeof e.default.Partnership;
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

### Repositories (Neo4j legacy)

- Extend `DtoRepository` from `~/core/neo4j`
- Use `cypher-query-builder` for query composition
- `matchProps()`, `ACTIVE`, `createProperty()`, `deactivateProperty()` are the Neo4j-specific helpers
- Return `UnsecuredDto<T>` (never apply security in the repo)

### Repositories (Gel)

- Use the auto-generated Gel client from `~/core/gel`
- EdgeQL queries via `e.select()`, `e.insert()`, etc.
- Return `UnsecuredDto<T>`

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
- `privileges.filterToReadable()` injects a database-level WHERE clause
- `privileges.secure(unsecuredDto)` wraps each field in `{ value, canRead, canEdit }`
- Policies are defined in `src/components/authorization/policies/`
- Conditions are in `src/components/authorization/policy/conditions/`

---

## Testing

**Primary pattern is E2E.** Unit tests exist but E2E tests are the main coverage vehicle.

```bash
yarn test          # unit tests
yarn test:e2e      # e2e tests (spins up full NestJS app + ephemeral Gel DB)
```

- E2E tests live in `test/*.e2e-spec.ts`
- Each test file gets its own ephemeral Gel database via `ephemeralGel()` in `createApp()`
- Use `createApp()` from `test/setup/create-app.ts` — do not bootstrap the app manually
- Use faker helpers from `test/operations/` for creating entities
- **Do NOT use `jest.unstable_mockModule`** in any spec file — it causes "import after environment torn down" errors across the entire test suite (ESM contamination)
- When creating language engagements in tests, always set `startDateOverride` and `endDateOverride` to match the project's MOU window, not `DateTime.now()` — otherwise progress reports won't exist for the expected fiscal quarter

---

## Commands

```bash
# Development
yarn start:dev          # dev server with hot reload
yarn start:debug        # debug mode

# Build
yarn build              # compile to dist/
yarn start:prod         # run compiled output

# Database
yarn gel:gen            # regenerate Gel TypeScript client (run after schema changes)
yarn gel:seed           # seed development data
yarn gel:migration      # run DB migrations via CLI console

# Code quality
yarn lint               # ESLint --fix, fails on any warning (--max-warnings 0)
yarn type-check         # tsc check only (no emit)

# Tests
yarn test               # unit (Jest, Unit project)
yarn test:e2e           # e2e (Jest, E2E project)

# Utilities
yarn clean              # remove dist, schema.graphql, generated gel files
yarn repl               # TypeScript REPL with app context
yarn console -- [cmd]   # CLI commands (e.g., gel migration)
```

---

## Code Conventions

- **File naming:** kebab-case, `{entity}.{role}.ts` — e.g. `user.service.ts`, `user.gel.repository.ts`
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

1. **`splitDb()` is the migration boundary.** Do not change the service/loader/resolver layers during a migration — only the repository layer changes.
2. **`*.neo4j.repository.ts` vs `*.repository.ts`**: Some modules use a separate `*.neo4j.repository.ts` filename; others embed Neo4j logic in the base `*.repository.ts`. Follow the existing pattern for the domain you're working in.
3. **Project + ProjectMember have circular filter dependencies** via lazy thunks — they must be migrated together.
4. **`status` on projects is a GENERATED column** — derived from `step`. Never write to it directly.
5. **Changeset-aware fields must be enumerated explicitly** — do not use an open JSONB blob.
6. **Hooks run inside the triggering transaction** — if a hook handler throws, the entire operation rolls back.
7. **`@seedcompany/*` packages** are internal — `@seedcompany/nest`, `@seedcompany/common`, `@seedcompany/data-loader`, etc. Check their source in `node_modules` if docs are sparse.
8. **Gel schema files** in `dbschema/` cover ~30 domains and are useful as a reference for data shape. ~14 domains have no Gel schema and require reading the Neo4j repository directly.
