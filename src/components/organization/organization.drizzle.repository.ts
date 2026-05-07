import { Injectable } from '@nestjs/common';
import { and, eq, ilike, inArray, isNull, type SQL } from 'drizzle-orm';
import { DateTime } from 'luxon';
import {
  EnhancedResource,
  generateId,
  type ID,
  type PaginatedListType,
  type UnsecuredDto,
} from '~/common';
import {
  catchUniqueViolation,
  DrizzleDtoRepository,
  escapeLikePattern,
  resolveOrderBy,
  type SortMap,
} from '~/core/drizzle';
import { DrizzleService } from '~/core/drizzle/drizzle.service';
import { organizations, userOrganizations } from '~/core/drizzle/schema';
import { PolicyExecutor } from '../authorization/policy/executor/policy-executor';
import {
  type CreateOrganization,
  Organization,
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
  private readonly resource = EnhancedResource.of(Organization);

  constructor(
    db: DrizzleService,
    private readonly executor: PolicyExecutor,
  ) {
    super(db, organizations);
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
    await this.softDelete(id);
  }

  async list(
    input: OrganizationListInput,
  ): Promise<PaginatedListType<UnsecuredDto<Organization>>> {
    const filter = this.executor.drizzleFilter({
      action: 'read',
      resource: this.resource,
    });
    if (filter === false) return { items: [], total: 0, hasMore: false };

    const conditions: SQL[] = [isNull(organizations.deletedAt)];
    if (filter !== true) conditions.push(filter);

    if (input.filter?.name) {
      conditions.push(
        ilike(organizations.name, `%${escapeLikePattern(input.filter.name)}%`),
      );
    }
    if (input.filter?.userId) {
      const userOrgSubq = this.db
        .select({ orgId: userOrganizations.organizationId })
        .from(userOrganizations)
        .where(eq(userOrganizations.userId, input.filter.userId));
      conditions.push(inArray(organizations.id, userOrgSubq));
    }

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
    return {
      total,
      items: rows.map((row) => this.toDto(row)),
      hasMore,
    };
  }

  protected toDto(
    row: typeof organizations.$inferSelect,
  ): UnsecuredDto<Organization> {
    return {
      id: row.id,
      __typename: 'Organization',
      createdAt: DateTime.fromJSDate(row.createdAt),
      name: row.name,
      acronym: row.acronym ?? null,
      address: row.address ?? null,
      types: row.types,
      reach: row.reach,
      sensitivity: row.sensitivity,
    };
  }
}
