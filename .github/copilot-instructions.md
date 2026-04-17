# GitHub Copilot Instructions — CORD API v3

## Project Context

CORD API v3 is a **Bible translation project management API**. It is a NestJS + TypeScript application that is 100% GraphQL (code-first, no REST). The primary database is Neo4j (legacy), being migrated domain-by-domain to **Gel** (a next-generation graph database). Node >= 24, `"type": "module"` (ESM), Yarn v4.

---

## File and Naming Conventions

- File names are **kebab-case**: `project.service.ts`, `user.gel.repository.ts`
- Pattern: `{entity}.{role}.ts` — roles are `module`, `resolver`, `service`, `repository`, `loader`, `dto`
- Gel repositories are `{entity}.gel.repository.ts`; Neo4j are `{entity}.repository.ts` (or `{entity}.neo4j.repository.ts`)
- Each `dto/` folder has an `index.ts` barrel
- Use `~/` path alias for `src/` imports — never use deep relative paths across modules

---

## GraphQL / Resolver Patterns

```typescript
@Resolver(() => EntityName)
export class EntityNameResolver {
  constructor(private readonly service: EntityNameService) {}

  @Query(() => EntityName)
  async entityName(@IdArg() id: ID): Promise<EntityName> {
    return await this.service.readOne(id);
  }

  @Mutation(() => CreateEntityNameOutput)
  async createEntityName(@Args() input: CreateEntityName): Promise<CreateEntityNameOutput> {
    return await this.service.create(input);
  }

  @ResolveField(() => String, { nullable: true })
  someComputedField(@Parent() entity: EntityName): string | undefined {
    return entity.someField.value;
  }
}
```

- Use `@IdArg()` (not `@Args('id')`) for single ID parameters
- `@ResolveField()` for any derived or related fields
- Never access repositories from resolvers — call services only

---

## DTO Patterns

```typescript
import { Field, ObjectType } from '@nestjs/graphql';
import {
  Calculated,
  IntersectTypes,
  Resource,
  type ResourceRelationsShape,
  SecuredBoolean,
  SecuredString,
  SecuredDateNullable,
} from '~/common';
import { e } from '~/core/gel';
import { RegisterResource } from '~/core/resources';
import { OtherEntity } from '../other-entity/dto';

const Interfaces = IntersectTypes(Resource);

@RegisterResource({ db: e.EntityName })
@ObjectType({ implements: Interfaces.members })
export class EntityName extends Interfaces {
  static readonly Relations = (() => ({
    ...Resource.Relations(),
    relatedEntity: OtherEntity,
  })) satisfies ResourceRelationsShape;

  @Field()
  readonly name: SecuredString;

  @Field()
  readonly active: SecuredBoolean;

  @Calculated()
  @Field()
  readonly computedDate: SecuredDateNullable;
}

// Always augment ResourceMap in the same DTO file:
declare module '~/core/resources/map' {
  interface ResourceMap { EntityName: typeof EntityName; }
  interface ResourceDBMap { EntityName: typeof e.default.EntityName; }
}
```

**Secured field types:** `SecuredString`, `SecuredStringNullable`, `SecuredBoolean`, `SecuredInt`, `SecuredFloat`, `SecuredDate`, `SecuredDateNullable`, `SecuredProperty(SomeType)`, `SecuredList(SomeType)`.

- `@Calculated()` marks fields that are computed, not stored — skip security resolution
- `static readonly Relations` defines relationships for the loader system
- `static readonly Parent` (thunk) when the entity belongs to a parent entity

---

## Service Patterns

```typescript
@Injectable()
export class EntityNameService {
  constructor(
    private readonly repo: EntityNameRepository,
    private readonly privileges: Privileges,
    private readonly hooks: Hooks,
  ) {}

  async readOne(id: ID, view?: ObjectView): Promise<EntityName> {
    const dto = await this.repo.readOne(id, view);
    const privileges = this.privileges.for(EntityName);
    return privileges.secure(dto);
  }

  async create(input: CreateEntityName): Promise<EntityName> {
    const dto = await this.repo.create(input);
    await this.hooks.run(new EntityNameCreatedHook(dto));
    return this.privileges.for(EntityName).secure(dto);
  }
}
```

- Services return fully secured DTOs (`EntityName`, not `UnsecuredDto<EntityName>`)
- Repositories return `UnsecuredDto<EntityName>` — call `privileges.secure()` in the service
- Use `Hooks` for lifecycle events after mutations

---

## Repository Patterns

### Neo4j (legacy)
```typescript
import { DtoRepository } from '~/core/neo4j';

@Injectable()
export class EntityNameRepository extends DtoRepository(EntityName) {
  async readOne(id: ID): Promise<UnsecuredDto<EntityName>> {
    const result = await this.db.query()
      .match([node('node', 'EntityName', { id })])
      .apply(matchProps())
      .return('props')
      .first();
    return this.db.hydrateOrFail(result, id);
  }
}
```

### Gel (new)
```typescript
import { e, GelService } from '~/core/gel';

@Injectable()
export class EntityNameGelRepository {
  constructor(private readonly gel: GelService) {}

  async readOne(id: ID): Promise<UnsecuredDto<EntityName>> {
    const result = await this.gel.run(
      e.select(e.EntityName, (n) => ({
        filter_single: e.op(n.id, '=', e.uuid(id)),
        id: true,
        name: true,
        active: true,
      }))
    );
    if (!result) throw new NotFoundException();
    return result;
  }
}
```

### splitDb registration
```typescript
// In {entity}.module.ts — route to Gel if available, else Neo4j:
splitDb(EntityNameRepository, { gel: EntityNameGelRepository })
```

---

## Hooks (Internal Event Bus)

```typescript
// Hook definition (plain class, no base class required)
export class EntityNameCreatedHook {
  constructor(readonly entity: EntityName) {}
}

// Handler
@Injectable()
export class SomeHandler {
  @OnHook(EntityNameCreatedHook)
  async handle(event: EntityNameCreatedHook) {
    // runs in the same DB transaction as the triggering mutation
    // can mutate event fields — subsequent handlers see the change
  }
}
```

- Import `OnHook` from `~/core/hooks`
- Lower priority number = runs first (default 0): `@OnHook(HookClass, 10)` runs after defaults
- Handlers throw → entire transaction rolls back

---

## Authorization

```typescript
// In a service — check before acting:
const privileges = this.privileges.for(this.session, EntityName, entity);
privileges.verifyCan('edit');

// Secure a repo result for return:
return privileges.secure(unsecuredDto);

// In a resolver — check secured field before accessing value:
if (entity.name.canRead) {
  return entity.name.value;
}
```

Policies are defined in `src/components/authorization/policies/`. Conditions are in `src/components/authorization/policy/conditions/`. Do not bypass `secure()` — it is the access control gate.

---

## Testing

E2E tests are the primary pattern. Unit tests are used for pure logic only.

```typescript
// test/*.e2e-spec.ts
import { createApp } from './setup/create-app';

describe('EntityName', () => {
  let app: TestApp;
  beforeAll(async () => { app = await createApp(); });

  it('creates an entity', async () => {
    const result = await app.graphql.query(/* ... */);
    expect(result).toMatchObject({ /* ... */ });
  });
});
```

- Use `createApp()` from `test/setup/create-app.ts` — it provisions an ephemeral Gel DB
- Use faker helpers from `test/operations/` for test data creation
- **Never** use `jest.unstable_mockModule` — it causes ESM contamination across test files
- When creating language engagements, always override `startDateOverride` / `endDateOverride` to match the MOU window

---

## What NOT to Do

- **No REST controllers** — the entire API is GraphQL
- **No `any` types** — use `unknown` and narrow properly
- **No repository calls from resolvers** — resolvers → services → repositories
- **No `npm` commands** — always use `yarn`
- **No `jest.unstable_mockModule`** — ESM contamination issue
- **Do not return unsecured DTOs from services** — always call `privileges.secure()` first
- **Do not touch the loader/service layer when migrating a repository** — only the repo changes
- **Do not write to generated `status` column** on projects — it is `GENERATED ALWAYS AS`
- **Do not add changeset fields as an open JSONB blob** — enumerate them explicitly
