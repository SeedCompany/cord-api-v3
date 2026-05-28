import { Injectable } from '@nestjs/common';
import {
  and,
  arrayOverlaps,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  type SQL,
} from 'drizzle-orm';
import { DateTime } from 'luxon';
import {
  CalendarDate,
  DuplicateException,
  generateId,
  type ID,
  NotImplementedException,
  type PaginatedListType,
  type UnsecuredDto,
} from '~/common';
import {
  catchForeignKeyViolation,
  DrizzleDtoRepository,
  EMPTY_PAGE,
  resolveOrderBy,
  type SortMap,
  subFilter,
} from '~/core/drizzle';
import { type DrizzleDb, DrizzleService } from '~/core/drizzle/drizzle.service';
import {
  departmentIdBlocks,
  organizations,
  partnerCountries,
  partnerFieldRegions,
  partnerLanguagesOfConsulting,
  partners,
  userOrganizations,
} from '~/core/drizzle/schema';
import { PolicyExecutor } from '../authorization/policy/executor/policy-executor';
import { type FinanceDepartmentIdBlock } from '../finance/department/dto/id-blocks.dto';
import { type FinanceDepartmentIdBlockInput } from '../finance/department/dto/id-blocks.input';
import {
  organizationFilterClauses,
  organizationSortColumns,
} from '../organization/organization.drizzle.repository';
import {
  type CreatePartner,
  Partner,
  type PartnerFilters,
  type PartnerListInput,
  type UpdatePartner,
} from './dto';

/** A partner row plus the related rows the DTO needs (junctions + IdBlock). */
type PartnerRow = typeof partners.$inferSelect & {
  fieldRegions: Array<{ fieldRegionId: ID<'FieldRegion'> }>;
  countries: Array<{ locationId: ID<'Location'> }>;
  languagesOfConsulting: Array<{ languageId: ID<'Language'> }>;
  departmentIdBlock: typeof departmentIdBlocks.$inferSelect | null;
};

@Injectable()
export class PartnerDrizzleRepository extends DrizzleDtoRepository<
  typeof partners,
  Partner
> {
  constructor(
    db: DrizzleService,
    private readonly executor: PolicyExecutor,
  ) {
    super(db, partners, Partner);
  }

  async partnerIdByOrg(organizationId: ID): Promise<ID<'Partner'> | null> {
    const rows = await this.db
      .select({ id: partners.id })
      .from(partners)
      .where(
        and(
          eq(partners.organizationId, organizationId),
          isNull(partners.deletedAt),
        ),
      );
    return rows[0]?.id ?? null;
  }

  async create(input: CreatePartner): Promise<UnsecuredDto<Partner>> {
    if (await this.partnerIdByOrg(input.organization)) {
      throw new DuplicateException(
        'organization',
        'Partner for organization already exists.',
      );
    }

    const id = await generateId();
    const departmentIdBlockId = input.departmentIdBlock
      ? await this.insertBlock(input.departmentIdBlock)
      : null;

    await this.db.insert(partners).values({
      id,
      organizationId: input.organization,
      pointOfContactId: input.pointOfContact ?? null,
      types: [...(input.types ?? [])],
      financialReportingTypes: [...(input.financialReportingTypes ?? [])],
      pmcEntityCode: input.pmcEntityCode ?? null,
      globalInnovationsClient: input.globalInnovationsClient ?? false,
      active: input.active ?? false,
      address: input.address ?? null,
      languageOfWiderCommunicationId:
        input.languageOfWiderCommunication ?? null,
      languageOfReportingId: input.languageOfReporting ?? null,
      startDate: (input.startDate ?? CalendarDate.local()).toISODate(),
      approvedPrograms: [...(input.approvedPrograms ?? [])],
      departmentIdBlockId,
    });

    await this.replaceJunctions(id, {
      fieldRegions: input.fieldRegions,
      countries: input.countries,
      languagesOfConsulting: input.languagesOfConsulting,
    });

    return await this.readOne(id);
  }

  async update(changes: UpdatePartner): Promise<UnsecuredDto<Partner>> {
    const {
      id,
      pointOfContact,
      languageOfWiderCommunication,
      languageOfReporting,
      fieldRegions,
      countries,
      languagesOfConsulting,
      departmentIdBlock,
      startDate,
      types,
      financialReportingTypes,
      approvedPrograms,
      ...fields
    } = changes;

    await this.updateColumns(id, {
      pmcEntityCode: fields.pmcEntityCode,
      globalInnovationsClient: fields.globalInnovationsClient,
      active: fields.active,
      address: fields.address,
      pointOfContactId: pointOfContact,
      languageOfWiderCommunicationId: languageOfWiderCommunication,
      languageOfReportingId: languageOfReporting,
      types: types && [...types],
      financialReportingTypes: financialReportingTypes && [
        ...financialReportingTypes,
      ],
      approvedPrograms: approvedPrograms && [...approvedPrograms],
      startDate:
        startDate === undefined ? undefined : (startDate?.toISODate() ?? null),
    });

    await this.replaceJunctions(id, {
      fieldRegions,
      countries,
      languagesOfConsulting,
    });

    if (departmentIdBlock !== undefined) {
      await this.setBlock(id, departmentIdBlock);
    }

    return await this.readOne(id);
  }

  /**
   * Soft-delete. The service still calls `deleteNode(object)` (the Neo4j-base
   * name; Partner hasn't been converted to the `delete(id)` rename yet), so we
   * match that here. Soft-delete drops the row from the partial unique index,
   * freeing the organization for a new Partner.
   */
  async deleteNode(objectOrId: ID | { id: ID }): Promise<void> {
    const id = typeof objectOrId === 'string' ? objectOrId : objectOrId.id;
    await this.softDelete(id);
  }

  override async readMany(
    ids: readonly ID[],
  ): Promise<Array<UnsecuredDto<Partner>>> {
    if (ids.length === 0) return [];
    const rows = await this.db.query.partners.findMany({
      where: (p) => and(inArray(p.id, [...ids]), isNull(p.deletedAt)),
      with: {
        fieldRegions: true,
        countries: true,
        languagesOfConsulting: true,
        departmentIdBlock: true,
      },
    });
    return rows.map((row) => this.toDto(row));
  }

  async list(
    input: PartnerListInput,
  ): Promise<PaginatedListType<UnsecuredDto<Partner>>> {
    const conditions: SQL[] = [isNull(partners.deletedAt)];
    if (!this.executor.applyReadFilter(this.resource, conditions)) {
      return EMPTY_PAGE;
    }

    conditions.push(...partnerFilterClauses(this.db, input.filter));
    const predicate = and(...conditions);

    // Cast to string because `name` / `organization.*` aren't in `keyof
    // Partner` (the GraphQL enum widens beyond the DTO's declared fields).
    const sort = input.sort as string;

    const sortColumns = {
      active: partners.active,
      createdAt: partners.createdAt,
      modifiedAt: partners.updatedAt,
      startDate: partners.startDate,
    } satisfies Partial<SortMap<keyof Partner>>;

    // Cross-domain sort: ORDER BY a column on `organizations`. Hand-rolled
    // INNER JOIN (FK is NOT NULL) — when a second domain needs this same
    // pattern, extract a shared `paginatedSelectWithJoin` helper (mirror of
    // the `*FilterClauses` emergence story).
    //
    // migration-todo: the orgSortKey→orgSortColumn resolution (and the
    // parallel INNER JOIN block below) is the abstractable piece. Once a
    // second consumer (Partnership → `partner.*`, or Project →
    // `partnership.partner.*`) needs the same dance, extract
    // `resolveCrossDomainSort(sort, prefix, sortColumns)` +
    // `paginatedSelectWithJoin`. One data point isn't enough to lock in the
    // helper's signature yet.
    const orgSortKey =
      sort === 'name'
        ? 'name'
        : sort.startsWith('organization.')
          ? sort.slice('organization.'.length)
          : null;
    const orgSortColumn =
      orgSortKey && orgSortKey in organizationSortColumns
        ? organizationSortColumns[
            orgSortKey as keyof typeof organizationSortColumns
          ]
        : null;
    if (orgSortKey && !orgSortColumn) {
      throw new NotImplementedException(
        `Sorting partners by '${sort}' is not supported — ` +
          `'${orgSortKey}' is not a known sortable column on \`organizations\`.`,
      );
    }

    const direction = input.order === 'ASC' ? asc : desc;
    let pageIds: ReadonlyArray<{ id: ID<'Partner'> }>;
    let total: number;
    if (orgSortColumn) {
      const offset = (input.page - 1) * input.count;
      const [countResult, joined] = await Promise.all([
        this.db.select({ total: count() }).from(partners).where(predicate),
        this.db
          .select({ id: partners.id })
          .from(partners)
          .innerJoin(
            organizations,
            eq(partners.organizationId, organizations.id),
          )
          .where(predicate)
          .orderBy(direction(orgSortColumn), asc(partners.id))
          .limit(input.count)
          .offset(offset),
      ]);
      total = countResult[0]?.total ?? 0;
      pageIds = joined;
    } else {
      const page = await this.paginatedSelect({
        predicate,
        orderBy: resolveOrderBy(input, sortColumns, partners.createdAt),
        page: input.page,
        count: input.count,
      });
      pageIds = page.rows.map((r) => ({ id: r.id }));
      total = page.total;
    }
    const offset = (input.page - 1) * input.count;
    const hasMore = offset + pageIds.length < total;

    // Two-phase list (deliberate, don't "optimize" into one big JOIN).
    //
    // Phase 1 returns paginated partner IDs (count + page query above run in
    // parallel via Promise.all). Phase 2 calls `readMany` which fetches every
    // partner row + its 3 junctions + the IdBlock in a single relational
    // findMany. Total = 2 parallel + 1 sequential round-trip per list call,
    // page-size-bounded, regardless of how many junction rows a partner has.
    //
    // Why not fold into one query: 3 junctions on each partner would either
    // cross-product the result (5 fieldRegions × 3 countries × 2 languages =
    // 30 rows per partner, requiring GROUP BY + array_agg to fold back) or
    // need LATERAL subqueries — both verbose and harder to maintain than the
    // small cost of one extra trip.
    //
    // Why reuse `readMany`: it's the single source of truth for partner
    // hydration, shared with the DataLoader's batch reads. Any change to the
    // DTO shape (new field, new junction, IdBlock shape change) lives in one
    // place — `list` and the loader benefit automatically.
    //
    // Order is preserved by indexing readMany's result by ID and walking
    // `pageIds` in its paginated order. `flatMap(... ?? [])` is the safe
    // "skip if missing" — should never fire since the IDs come from the same
    // query family, but it keeps list() robust if a row vanishes between
    // phases (e.g. a concurrent soft-delete).
    const dtos = await this.readMany(pageIds.map((r) => r.id));
    const byId = new Map(dtos.map((d) => [d.id, d]));
    return {
      total,
      hasMore,
      items: pageIds.flatMap((r) => byId.get(r.id) ?? []),
    };
  }

  // ── helpers ────────────────────────────────────────────────────────────

  private async insertBlock(
    block: NonNullable<CreatePartner['departmentIdBlock']>,
  ): Promise<ID> {
    const blockId = await generateId();
    await this.db.insert(departmentIdBlocks).values({
      id: blockId,
      range: [...block.blocks],
      programs: [...(block.programs ?? [])],
    });
    return blockId;
  }

  private async setBlock(
    partnerId: ID,
    block: FinanceDepartmentIdBlockInput | null,
  ): Promise<void> {
    // Lock the partner row for the rest of the surrounding transaction (the
    // DrizzleTransactionalMutationsInterceptor opens one per mutation). Without
    // this, two concurrent setBlock calls on the same partner could both read
    // `blockId = null`, both insert a fresh block, and one's `partners` update
    // would clobber the other — orphaning a `department_id_blocks` row.
    const [row] = await this.db
      .select({ blockId: partners.departmentIdBlockId })
      .from(partners)
      .where(eq(partners.id, partnerId))
      .for('update');
    const currentBlockId = row?.blockId ?? null;

    if (block === null) {
      if (currentBlockId) {
        await this.db
          .update(partners)
          .set({ departmentIdBlockId: null })
          .where(eq(partners.id, partnerId));
        await this.db
          .delete(departmentIdBlocks)
          .where(eq(departmentIdBlocks.id, currentBlockId));
      }
      return;
    }

    const values = {
      range: [...block.blocks],
      programs: [...(block.programs ?? [])],
    };
    if (currentBlockId) {
      await this.db
        .update(departmentIdBlocks)
        .set(values)
        .where(eq(departmentIdBlocks.id, currentBlockId));
    } else {
      const blockId = await generateId();
      await this.db
        .insert(departmentIdBlocks)
        .values({ id: blockId, ...values });
      await this.db
        .update(partners)
        .set({ departmentIdBlockId: blockId })
        .where(eq(partners.id, partnerId));
    }
  }

  /** Replace each provided junction list wholesale (undefined = leave as-is). */
  private async replaceJunctions(
    partnerId: ID,
    lists: {
      fieldRegions?: ReadonlyArray<ID<'FieldRegion'>>;
      countries?: ReadonlyArray<ID<'Location'>>;
      languagesOfConsulting?: ReadonlyArray<ID<'Language'>>;
    },
  ): Promise<void> {
    // FK-violation catches mirror the Neo4j repo's `e.withField(...)` pattern
    // so a bad related ID surfaces as `InputException(field=…)` instead of
    // a generic DB error. Constraint substrings target the right-side FK of
    // each junction (PG default-names them `<table>_<column>_fkey`).
    if (lists.fieldRegions) {
      await this.db
        .delete(partnerFieldRegions)
        .where(eq(partnerFieldRegions.partnerId, partnerId));
      if (lists.fieldRegions.length) {
        await this.db
          .insert(partnerFieldRegions)
          .values(
            lists.fieldRegions.map((fieldRegionId) => ({
              partnerId,
              fieldRegionId,
            })),
          )
          .catch(
            catchForeignKeyViolation(
              'field_region_id_fkey',
              'fieldRegions',
              'One or more field region IDs do not exist',
            ),
          );
      }
    }
    if (lists.countries) {
      await this.db
        .delete(partnerCountries)
        .where(eq(partnerCountries.partnerId, partnerId));
      if (lists.countries.length) {
        await this.db
          .insert(partnerCountries)
          .values(
            lists.countries.map((locationId) => ({ partnerId, locationId })),
          )
          .catch(
            catchForeignKeyViolation(
              'location_id_fkey',
              'countries',
              'One or more country (location) IDs do not exist',
            ),
          );
      }
    }
    if (lists.languagesOfConsulting) {
      await this.db
        .delete(partnerLanguagesOfConsulting)
        .where(eq(partnerLanguagesOfConsulting.partnerId, partnerId));
      if (lists.languagesOfConsulting.length) {
        // Note: `language_id` has no DB-level FK yet (deferred until Language
        // migrates), so this catch is dormant today. Kept for forward-compat
        // — when the FK lands it'll start firing usefully without code change.
        await this.db
          .insert(partnerLanguagesOfConsulting)
          .values(
            lists.languagesOfConsulting.map((languageId) => ({
              partnerId,
              languageId,
            })),
          )
          .catch(
            catchForeignKeyViolation(
              'language_id_fkey',
              'languagesOfConsulting',
              'One or more language IDs do not exist',
            ),
          );
      }
    }
  }

  /**
   * Narrows the base-class param from the flat row to the enriched relational
   * row (junctions + IdBlock) — TS method-syntax bivariance allows this
   * override, mirroring how `UserDrizzleRepository.toDto` accepts its
   * relational shape. `readMany` always passes the enriched row.
   */
  protected toDto(row: PartnerRow): UnsecuredDto<Partner> {
    return {
      id: row.id,
      __typename: 'Partner',
      createdAt: DateTime.fromJSDate(row.createdAt),
      modifiedAt: DateTime.fromJSDate(row.updatedAt),
      organization: { id: row.organizationId },
      pointOfContact: row.pointOfContactId
        ? { id: row.pointOfContactId }
        : null,
      types: row.types,
      financialReportingTypes: row.financialReportingTypes,
      pmcEntityCode: row.pmcEntityCode,
      globalInnovationsClient: row.globalInnovationsClient,
      active: row.active,
      address: row.address,
      languageOfWiderCommunication: row.languageOfWiderCommunicationId
        ? { id: row.languageOfWiderCommunicationId }
        : null,
      languageOfReporting: row.languageOfReportingId
        ? { id: row.languageOfReportingId }
        : null,
      fieldRegions: row.fieldRegions.map((j) => ({ id: j.fieldRegionId })),
      countries: row.countries.map((j) => ({ id: j.locationId })),
      languagesOfConsulting: row.languagesOfConsulting.map((j) => ({
        id: j.languageId,
      })),
      startDate: row.startDate ? CalendarDate.fromISO(row.startDate) : null,
      approvedPrograms: row.approvedPrograms,
      departmentIdBlock:
        // Defense: a stored block with an empty range is unusable for ID
        // allocation (and the DTO declares `blocks: NonEmptyArray`, which the
        // int4multirange customType can't enforce at the type level). Surface
        // it as absent rather than constructing an invalid DTO that would
        // crash on the next `blocks[0]` access.
        row.departmentIdBlock && row.departmentIdBlock.range.length > 0
          ? {
              id: row.departmentIdBlock.id,
              // Cast is sound: `range.length > 0` checked just above.
              blocks: row.departmentIdBlock
                .range as FinanceDepartmentIdBlock['blocks'],
              programs: row.departmentIdBlock.programs,
            }
          : null,
      // migration-todo: derived from project sensitivity; 'High' until Project migrates.
      sensitivity: row.sensitivity,
      // migration-todo: per-user pin state; resolves via Pin once that migrates.
      pinned: false,
    };
  }
}

/**
 * Build the column-level WHERE clauses for a `PartnerFilters` input against the
 * `partners` table. Reusable from sub-filters in other domains (e.g. Project's
 * `partnership` filter delegates through Partnership to here).
 */
export const partnerFilterClauses = (
  db: DrizzleDb,
  filter: PartnerFilters | undefined,
): SQL[] => {
  const conditions: SQL[] = [];
  if (!filter) return conditions;
  if (filter.globalInnovationsClient !== undefined) {
    conditions.push(
      eq(partners.globalInnovationsClient, filter.globalInnovationsClient),
    );
  }
  if (filter.types?.length) {
    conditions.push(arrayOverlaps(partners.types, [...filter.types]));
  }
  if (filter.financialReportingTypes?.length) {
    conditions.push(
      arrayOverlaps(partners.financialReportingTypes, [
        ...filter.financialReportingTypes,
      ]),
    );
  }
  if (filter.organization) {
    conditions.push(
      subFilter(
        db,
        partners.organizationId,
        organizations,
        organizationFilterClauses(db, filter.organization),
      ),
    );
  }
  if (filter.userId) {
    const orgSubq = db
      .select({ id: userOrganizations.organizationId })
      .from(userOrganizations)
      .where(eq(userOrganizations.userId, filter.userId));
    conditions.push(inArray(partners.organizationId, orgSubq));
  }
  if (filter.startDate) {
    const f = filter.startDate;
    // `partners.start_date` is a PG `date` column → ISO date strings.
    if (f.after) conditions.push(gt(partners.startDate, f.after.toISODate()));
    if (f.afterInclusive) {
      conditions.push(gte(partners.startDate, f.afterInclusive.toISODate()));
    }
    if (f.before) conditions.push(lt(partners.startDate, f.before.toISODate()));
    if (f.beforeInclusive) {
      conditions.push(lte(partners.startDate, f.beforeInclusive.toISODate()));
    }
    if (f.isNull !== undefined) {
      conditions.push(
        f.isNull ? isNull(partners.startDate) : isNotNull(partners.startDate),
      );
    }
  }
  if (filter.createdAt) {
    const f = filter.createdAt;
    // `partners.created_at` is a `timestamptz` column → JS `Date`.
    if (f.after) conditions.push(gt(partners.createdAt, f.after.toJSDate()));
    if (f.afterInclusive) {
      conditions.push(gte(partners.createdAt, f.afterInclusive.toJSDate()));
    }
    if (f.before) conditions.push(lt(partners.createdAt, f.before.toJSDate()));
    if (f.beforeInclusive) {
      conditions.push(lte(partners.createdAt, f.beforeInclusive.toJSDate()));
    }
    // `created_at` is NOT NULL — `isNull` is effectively a no-op, but support
    // it for API parity so callers get consistent semantics.
    if (f.isNull !== undefined) {
      conditions.push(
        f.isNull ? isNull(partners.createdAt) : isNotNull(partners.createdAt),
      );
    }
  }
  if (filter.pinned !== undefined) {
    // migration-todo: drop this stub when Pin migrates and the
    // `partners.pinned-by-current-user` lookup table exists.
    throw new NotImplementedException(
      "Filtering partners by 'pinned' is not yet supported in postgres mode " +
        '(Pin domain has not migrated).',
    );
  }
  return conditions;
};
