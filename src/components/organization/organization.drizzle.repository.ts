import { Injectable } from '@nestjs/common';
import { and, eq, ilike, inArray, isNull, type SQL } from 'drizzle-orm';
import { DateTime } from 'luxon';
import {
  generateId,
  type ID,
  type PaginatedListType,
  type UnsecuredDto,
} from '~/common';
import { Identity } from '~/core/authentication';
import {
  catchUniqueViolation,
  DrizzleDtoRepository,
  EMPTY_PAGE,
  escapeLikePattern,
  resolveOrderBy,
  type SortMap,
} from '~/core/drizzle';
import { type DrizzleDb, DrizzleService } from '~/core/drizzle/drizzle.service';
import {
  organizationLocations,
  organizations,
  userOrganizations,
} from '~/core/drizzle/schema';
import { type ScopedRole } from '../authorization/dto/role.dto';
import { PolicyExecutor } from '../authorization/policy/executor/policy-executor';
import { requesterScopeByOrganization } from '../project/project-member/membership-scope';
import {
  type CreateOrganization,
  Organization,
  type OrganizationFilters,
  type OrganizationListInput,
  type UpdateOrganization,
} from './dto';

const catchNameUnique = catchUniqueViolation(
  'name',
  'name',
  'Organization with this name already exists',
);

@Injectable()
export class OrganizationDrizzleRepository extends DrizzleDtoRepository<
  typeof organizations,
  Organization
> {
  constructor(
    db: DrizzleService,
    private readonly executor: PolicyExecutor,
    private readonly identity: Identity,
  ) {
    super(db, organizations, Organization);
  }

  /**
   * Attaches each org's `scope` — the requesting user's project-membership
   * roles unioned across every project reachable via a live Partnership. The
   * base class's `readMany` doesn't know about this, so it's overridden here
   * (mirroring Ceremony/ProjectMember's overrides for their own extra joins).
   * Without it, `member`-gated policies (e.g. FinancialAnalyst reading a
   * High-sensitivity org) throw `MissingContextException` instead of
   * evaluating membership, because `getScope()` finds no `scope` on the DTO.
   */
  override async readMany(
    ids: readonly ID[],
  ): Promise<Array<UnsecuredDto<Organization>>> {
    if (ids.length === 0) return [];
    const rows = await this.db
      .select()
      .from(organizations)
      .where(
        and(
          inArray(organizations.id, [...ids]),
          isNull(organizations.deletedAt),
        ),
      );
    const scopeByOrg = await requesterScopeByOrganization(
      this.db,
      this.identity.current.userId,
      rows.map((row) => row.id),
    );
    return rows.map((row) => this.toDto(row, scopeByOrg.get(row.id) ?? []));
  }

  async create(input: CreateOrganization): Promise<UnsecuredDto<Organization>> {
    const id = await generateId();
    await this.db
      .insert(organizations)
      .values({
        id,
        name: input.name,
        acronym: input.acronym ?? null,
        address: input.address ?? null,
        types: [...(input.types ?? [])],
        reach: [...(input.reach ?? [])],
      })
      .catch(catchNameUnique);
    return await this.readOne(id);
  }

  async update(
    changes: UpdateOrganization,
  ): Promise<UnsecuredDto<Organization>> {
    const { id, ...fields } = changes;
    await this.updateColumns(id, {
      name: fields.name,
      acronym: fields.acronym,
      address: fields.address,
      types: fields.types && [...fields.types],
      reach: fields.reach && [...fields.reach],
    }).catch(catchNameUnique);
    return await this.readOne(id);
  }

  async delete(id: ID): Promise<void> {
    // Soft-delete bypasses FK cascade, so clear joins explicitly — otherwise
    // a stale primary=true row would block future primary-org reassignment
    // via the user_organizations_one_primary_per_user partial unique index.
    await this.db
      .delete(organizationLocations)
      .where(eq(organizationLocations.organizationId, id));
    await this.db
      .delete(userOrganizations)
      .where(eq(userOrganizations.organizationId, id));
    await this.softDelete(id);
  }

  async list(
    input: OrganizationListInput,
  ): Promise<PaginatedListType<UnsecuredDto<Organization>>> {
    const conditions: SQL[] = [isNull(organizations.deletedAt)];
    if (!this.executor.applyReadFilter(this.resource, conditions)) {
      return EMPTY_PAGE;
    }

    conditions.push(...organizationFilterClauses(this.db, input.filter));

    const sortColumns = {
      name: organizations.name,
      acronym: organizations.acronym,
      address: organizations.address,
      sensitivity: organizations.sensitivity,
      createdAt: organizations.createdAt,
    } satisfies SortMap<keyof Organization>;

    const { rows, total, hasMore } = await this.paginatedSelect({
      predicate: and(...conditions),
      orderBy: resolveOrderBy(input, sortColumns, organizations.name),
      page: input.page,
      count: input.count,
    });
    if (rows.length === 0) return { total, items: [], hasMore };
    const items = await this.readMany(rows.map((row) => row.id));
    const byId = new Map(items.map((item) => [item.id, item]));
    return {
      total,
      items: rows.map((row) => byId.get(row.id)!).filter(Boolean),
      hasMore,
    };
  }

  protected toDto(
    row: typeof organizations.$inferSelect,
    scope: ScopedRole[] = [],
  ): UnsecuredDto<Organization> {
    const dto: unknown = {
      id: row.id,
      __typename: 'Organization',
      createdAt: DateTime.fromJSDate(row.createdAt),
      name: row.name,
      acronym: row.acronym ?? null,
      address: row.address ?? null,
      types: row.types,
      reach: row.reach,
      sensitivity: row.sensitivity,
      scope,
    };
    return dto as UnsecuredDto<Organization>;
  }
}

/**
 * Build the column-level WHERE clauses for an `OrganizationFilters` input
 * against the `organizations` table. Reusable from sub-filters in other
 * domains (e.g. Partner's `organization` filter).
 */
export const organizationFilterClauses = (
  db: DrizzleDb,
  filter: OrganizationFilters | undefined,
): SQL[] => {
  const conditions: SQL[] = [];
  if (!filter) return conditions;
  if (filter.name) {
    conditions.push(
      ilike(organizations.name, `%${escapeLikePattern(filter.name)}%`),
    );
  }
  if (filter.userId) {
    const userOrgSubq = db
      .select({ orgId: userOrganizations.organizationId })
      .from(userOrganizations)
      .where(eq(userOrganizations.userId, filter.userId));
    conditions.push(inArray(organizations.id, userOrgSubq));
  }
  return conditions;
};

/**
 * Sortable columns on `organizations`, keyed by GraphQL sort field. Exported
 * for cross-domain sort delegation (e.g. Partner's `organization.*` sort joins
 * to `organizations` and orders by one of these). Counterpart to
 * `organizationFilterClauses`.
 *
 * Neo4j's `organizationSorters` is empty (`defineSorters(Organization, {})`),
 * relying on its base-node-prop fallback to sort by any scalar Property. The
 * values here are the meaningful sortable columns on the PG table.
 */
export const organizationSortColumns = {
  name: organizations.name,
  acronym: organizations.acronym,
  address: organizations.address,
  sensitivity: organizations.sensitivity,
  createdAt: organizations.createdAt,
} as const;
