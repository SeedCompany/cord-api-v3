import { Injectable } from '@nestjs/common';
import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  isNull,
  ne,
  sql,
  type SQL,
} from 'drizzle-orm';
import { DateTime } from 'luxon';
import {
  CalendarDate,
  CreationFailed,
  DuplicateException,
  generateId,
  type ID,
  NotFoundException,
  NotImplementedException,
  type ObjectView,
  type PaginatedListType,
  type UnsecuredDto,
} from '~/common';
import { Identity } from '~/core/authentication';
import {
  DrizzleDtoRepository,
  EMPTY_PAGE,
  isUniqueViolation,
  resolveOrderBy,
  type SortMap,
  subFilter,
} from '~/core/drizzle';
import { type DrizzleDb, DrizzleService } from '~/core/drizzle/drizzle.service';
import { partners, partnerships, projects } from '~/core/drizzle/schema';
import { type ScopedRole } from '../authorization/dto/role.dto';
import { PolicyExecutor } from '../authorization/policy/executor/policy-executor';
import { FileService } from '../file';
import {
  partnerFilterClauses,
  partnerSortColumns,
} from '../partner/partner.drizzle.repository';
import { requesterScopeByProject } from '../project/project-member/membership-scope';
import {
  type CreatePartnership,
  Partnership,
  type PartnershipFilters,
  type PartnershipListInput,
  type UpdatePartnership,
} from './dto';
import { type PartnershipByProjectAndPartnerInput } from './partnership-by-project-and-partner.loader';

/**
 * Relational findMany row shape: the partnership row plus the parent project
 * (id, type, sensitivity, mou_start, mou_end — sensitivity inherited onto the
 * DTO; project mou dates feed the override coalesce) and the partner
 * (id, organization_id — the DTO carries the partner's organization too,
 * mirroring the Neo4j hydrate's `org { .id }` overlay).
 */
type PartnershipRow = typeof partnerships.$inferSelect & {
  project: Pick<
    typeof projects.$inferSelect,
    'id' | 'type' | 'sensitivity' | 'mouStart' | 'mouEnd'
  > | null;
  partner: Pick<typeof partners.$inferSelect, 'id' | 'organizationId'> | null;
};

@Injectable()
export class PartnershipDrizzleRepository extends DrizzleDtoRepository<
  typeof partnerships,
  Partnership
> {
  constructor(
    db: DrizzleService,
    private readonly executor: PolicyExecutor,
    private readonly identity: Identity,
    private readonly files: FileService,
  ) {
    super(db, partnerships, Partnership);
  }

  /** Attach the requester's project-scoped roles to each row's DTO. */
  private async mapRowsWithScope(rows: PartnershipRow[]) {
    const scopeByProject = await requesterScopeByProject(
      this.db,
      this.identity.current.userId,
      rows.flatMap((r) => r.project?.id ?? []),
    );
    return rows.map((row) =>
      this.toDto(
        row,
        row.project ? (scopeByProject.get(row.project.id) ?? []) : [],
      ),
    );
  }

  /**
   * Create a partnership. Verifies project + partner exist and that no
   * (project, partner) partnership already exists; the partial unique index
   * (`partnerships_project_partner_active_unique`) is the DB-level backstop.
   *
   * MOU + Agreement defined files: the FKs are stored here; createDefinedFile
   * makes the (version-less) placeholder nodes after the row lands.
   *
   * `changeset` accepted for splitDb signature parity; PCR/Changeset is
   * excluded from the migration entirely, so it's silently ignored.
   */
  async create(input: CreatePartnership, _changeset?: ID): Promise<{ id: ID }> {
    await this.verifyRelationshipEligibility(input.project, input.partner);

    const id = await generateId<ID<'Partnership'>>();
    const mouId = await generateId();
    const agreementId = await generateId();
    const values = {
      id,
      projectId: input.project,
      partnerId: input.partner,
      agreementStatus: input.agreementStatus ?? 'NotAttached',
      mouStatus: input.mouStatus ?? 'NotAttached',
      mouId,
      agreementId,
      mouStartOverride: input.mouStartOverride
        ? input.mouStartOverride.toSQLDate()
        : null,
      mouEndOverride: input.mouEndOverride
        ? input.mouEndOverride.toSQLDate()
        : null,
      types: input.types ? [...input.types] : [],
      financialReportingType: input.financialReportingType ?? null,
      primary: input.primary ?? false,
    };
    try {
      // Nested transaction = savepoint, so a primary-race conflict below
      // doesn't poison the surrounding mutation transaction.
      await this.db.transaction(async (tx) => {
        await tx.insert(partnerships).values(values);
      });
    } catch (e) {
      if (
        values.primary &&
        isUniqueViolation(e, 'partnerships_project_primary_active_unique')
      ) {
        // Lost the primary race — a concurrent create on the same project
        // already claimed primary (the service's isFirstPartnership check
        // isn't atomic). Yield and create this one as non-primary.
        await this.db
          .insert(partnerships)
          .values({ ...values, primary: false })
          .catch((e2) => {
            throw new CreationFailed(Partnership, { cause: e2 as Error });
          });
      } else {
        throw new CreationFailed(Partnership, { cause: e as Error });
      }
    }

    await this.files.createDefinedFile(mouId, `MOU`, id, 'mou', input.mou);
    await this.files.createDefinedFile(
      agreementId,
      `Partner Agreement`,
      id,
      'agreement',
      input.agreement,
    );

    return { id };
  }

  /**
   * Apply a partial change set. The service handles the primary-flag transfer
   * by calling `removePrimaryFromOtherPartnerships` separately before update;
   * the partial unique index on `(project_id) WHERE primary = true` is the
   * DB-level backstop.
   */
  async update(
    changes: Omit<UpdatePartnership, 'mou' | 'agreement'>,
    _changeset?: ID,
  ): Promise<void> {
    const { id, ...fields } = changes;
    await this.updateColumns(id, {
      ...(fields.agreementStatus !== undefined && {
        agreementStatus: fields.agreementStatus,
      }),
      ...(fields.mouStatus !== undefined && { mouStatus: fields.mouStatus }),
      ...(fields.mouStartOverride !== undefined && {
        mouStartOverride: fields.mouStartOverride
          ? fields.mouStartOverride.toSQLDate()
          : null,
      }),
      ...(fields.mouEndOverride !== undefined && {
        mouEndOverride: fields.mouEndOverride
          ? fields.mouEndOverride.toSQLDate()
          : null,
      }),
      ...(fields.types !== undefined && { types: [...fields.types] }),
      ...(fields.financialReportingType !== undefined && {
        financialReportingType: fields.financialReportingType ?? null,
      }),
      ...(fields.primary !== undefined && { primary: fields.primary }),
    });
  }

  async deleteNode(
    object: { id: ID } | ID,
    _options?: { changeset?: ID },
  ): Promise<void> {
    const id = typeof object === 'string' ? object : object.id;
    await this.softDelete(id);
  }

  override async readMany(
    ids: readonly ID[],
    _view?: ObjectView,
  ): Promise<Array<UnsecuredDto<Partnership>>> {
    if (ids.length === 0) return [];
    const rows = await this.db.query.partnerships.findMany({
      where: (p) => and(inArray(p.id, [...ids]), isNull(p.deletedAt)),
      with: {
        project: {
          columns: {
            id: true,
            type: true,
            sensitivity: true,
            mouStart: true,
            mouEnd: true,
          },
        },
        partner: { columns: { id: true, organizationId: true } },
      },
    });
    return await this.mapRowsWithScope(rows as PartnershipRow[]);
  }

  /**
   * Resolve memberships keyed by `(project, partner)` pairs — drives the
   * `Project.partnership(partnerId)` resolver via the
   * PartnershipByProjectAndPartnerLoader. Read permission is enforced at the
   * resolver layer; this repo path returns the row if it exists.
   */
  async readManyByProjectAndPartner(
    input: readonly PartnershipByProjectAndPartnerInput[],
  ): Promise<Array<UnsecuredDto<Partnership>>> {
    if (input.length === 0) return [];
    const pairs = input.map(
      (i) =>
        and(
          eq(partnerships.projectId, i.project),
          eq(partnerships.partnerId, i.partner),
        )!,
    );
    const rows = await this.db.query.partnerships.findMany({
      where: (p) =>
        and(isNull(p.deletedAt), sql`(${sql.join(pairs, sql` OR `)})`),
      with: {
        project: {
          columns: {
            id: true,
            type: true,
            sensitivity: true,
            mouStart: true,
            mouEnd: true,
          },
        },
        partner: { columns: { id: true, organizationId: true } },
      },
    });
    return await this.mapRowsWithScope(rows as PartnershipRow[]);
  }

  /** Used by SetDepartmentId (multiplication-translation path) + others. */
  async listAllByProjectId(
    projectId: ID,
  ): Promise<Array<UnsecuredDto<Partnership>>> {
    const rows = await this.db.query.partnerships.findMany({
      where: (p) => and(eq(p.projectId, projectId), isNull(p.deletedAt)),
      with: {
        project: {
          columns: {
            id: true,
            type: true,
            sensitivity: true,
            mouStart: true,
            mouEnd: true,
          },
        },
        partner: { columns: { id: true, organizationId: true } },
      },
    });
    return await this.mapRowsWithScope(rows as PartnershipRow[]);
  }

  /**
   * True when `projectId` has no existing live partnerships. Drives
   * `PartnershipService.create`'s "auto-set primary on the first one" branch.
   */
  async isFirstPartnership(projectId: ID, _changeset?: ID): Promise<boolean> {
    const [row] = await this.db
      .select({ n: sql<number>`1` })
      .from(partnerships)
      .where(
        and(
          eq(partnerships.projectId, projectId),
          isNull(partnerships.deletedAt),
        ),
      )
      .limit(1);
    return !row;
  }

  /** True when there are other live partnerships on the same project. */
  async isAnyOtherPartnerships(id: ID): Promise<boolean> {
    const row = await this.db.query.partnerships.findFirst({
      where: (p) => and(eq(p.id, id), isNull(p.deletedAt)),
      columns: { projectId: true },
    });
    if (!row) return false;
    const [other] = await this.db
      .select({ n: sql<number>`1` })
      .from(partnerships)
      .where(
        and(
          eq(partnerships.projectId, row.projectId),
          ne(partnerships.id, id),
          isNull(partnerships.deletedAt),
        ),
      )
      .limit(1);
    return !!other;
  }

  /**
   * Clear `primary = false` on every other live partnership on the same
   * project. The partial unique index
   * `partnerships_project_primary_active_unique` enforces "at most one
   * primary"; this method is what makes the app side of the flip atomic.
   * Returns the affected partnership ids for hook fan-out.
   */
  async removePrimaryFromOtherPartnerships(id: ID): Promise<Array<{ id: ID }>> {
    const row = await this.db.query.partnerships.findFirst({
      where: (p) => and(eq(p.id, id), isNull(p.deletedAt)),
      columns: { projectId: true },
    });
    if (!row) return [];
    const affected = await this.db
      .update(partnerships)
      .set({ primary: false, updatedAt: new Date() })
      .where(
        and(
          eq(partnerships.projectId, row.projectId),
          ne(partnerships.id, id),
          eq(partnerships.primary, true),
          isNull(partnerships.deletedAt),
        ),
      )
      .returning({ id: partnerships.id });
    return affected as Array<{ id: ID }>;
  }

  async list(
    input: PartnershipListInput,
    _changeset?: ID,
  ): Promise<PaginatedListType<UnsecuredDto<Partnership>>> {
    const conditions: SQL[] = [isNull(partnerships.deletedAt)];
    if (!this.executor.applyReadFilter(this.resource, conditions)) {
      return EMPTY_PAGE;
    }
    conditions.push(...partnershipFilterClauses(this.db, input.filter));
    const predicate = and(...conditions);

    // Cast to string — `partner.*` keys aren't in `keyof Partnership`.
    const sort = input.sort as string;
    const direction = input.order === 'ASC' ? asc : desc;

    // migration-todo: third consumer of the cross-domain JOIN-sort pattern
    // (Partner → organization.*, Project → primaryLocation.*/fieldRegion.*,
    // now Partnership → partner.*). Time to extract a shared
    // `resolveCrossDomainSort` + `paginatedSelectWithJoin` into
    // `~/core/drizzle`. Tracked as a small follow-up cleanup PR.
    const partnerSortKey = sort.startsWith('partner.')
      ? sort.slice('partner.'.length)
      : null;
    const partnerSortColumn =
      partnerSortKey && partnerSortKey in partnerSortColumns
        ? partnerSortColumns[partnerSortKey as keyof typeof partnerSortColumns]
        : null;
    if (partnerSortKey && !partnerSortColumn) {
      throw new NotImplementedException(
        `Sorting partnerships by '${sort}' is not supported — ` +
          `'${partnerSortKey}' is not a known sortable column on \`partners\`.`,
      );
    }

    let pageIds: ReadonlyArray<{ id: ID<'Partnership'> }>;
    let total: number;
    if (partnerSortColumn) {
      const offset = (input.page - 1) * input.count;
      const [countResult, joined] = await Promise.all([
        this.db.select({ total: count() }).from(partnerships).where(predicate),
        this.db
          .select({ id: partnerships.id })
          .from(partnerships)
          .innerJoin(partners, eq(partnerships.partnerId, partners.id))
          .where(predicate)
          .orderBy(direction(partnerSortColumn), asc(partnerships.id))
          .limit(input.count)
          .offset(offset),
      ]);
      total = countResult[0]?.total ?? 0;
      pageIds = joined;
    } else {
      const sortColumns = partnershipSortColumns;
      const page = await this.paginatedSelect({
        predicate,
        orderBy: resolveOrderBy(input, sortColumns, partnerships.createdAt),
        page: input.page,
        count: input.count,
      });
      pageIds = page.rows.map((r) => ({ id: r.id }));
      total = page.total;
    }
    const offset = (input.page - 1) * input.count;
    const hasMore = offset + pageIds.length < total;
    if (pageIds.length === 0) return { total, items: [], hasMore };

    const dtos = await this.readMany(pageIds.map((r) => r.id));
    const byId = new Map(dtos.map((d) => [d.id, d]));
    return {
      total,
      items: pageIds.flatMap((r) => byId.get(r.id) ?? []),
      hasMore,
    };
  }

  private async verifyRelationshipEligibility(
    projectId: ID,
    partnerId: ID,
  ): Promise<void> {
    const [project, partner, existing] = await Promise.all([
      this.db
        .select({ id: projects.id })
        .from(projects)
        .where(and(eq(projects.id, projectId), isNull(projects.deletedAt)))
        .limit(1),
      this.db
        .select({ id: partners.id })
        .from(partners)
        .where(and(eq(partners.id, partnerId), isNull(partners.deletedAt)))
        .limit(1),
      this.db
        .select({ id: partnerships.id })
        .from(partnerships)
        .where(
          and(
            eq(partnerships.projectId, projectId),
            eq(partnerships.partnerId, partnerId),
            isNull(partnerships.deletedAt),
          ),
        )
        .limit(1),
    ]);
    if (!project[0]) {
      throw new NotFoundException('Could not find project', 'project');
    }
    if (!partner[0]) {
      throw new NotFoundException('Could not find partner', 'partner');
    }
    if (existing[0]) {
      throw new DuplicateException(
        'project',
        'Partnership for this project and partner already exists',
      );
    }
  }

  protected toDto(
    row: PartnershipRow,
    scope: ScopedRole[] = [],
  ): UnsecuredDto<Partnership> {
    if (!row.project || !row.partner) {
      throw new Error(
        `Partnership ${row.id} missing parent project/partner — FK invariant violated`,
      );
    }
    // mou date coalesce: override → parent project. The Neo4j hydrate has a
    // 4-level chain (changeset override → row override → changeset project →
    // row project); PCR is excluded so the changeset branches collapse to
    // just the override + parent project pair.
    const mouStart = row.mouStartOverride ?? row.project.mouStart ?? null;
    const mouEnd = row.mouEndOverride ?? row.project.mouEnd ?? null;
    const dto: unknown = {
      id: row.id,
      __typename: 'Partnership',
      createdAt: DateTime.fromJSDate(row.createdAt),
      project: { id: row.project.id },
      partner: { id: row.partner.id },
      organization: { id: row.partner.organizationId },
      sensitivity: row.project.sensitivity,
      agreementStatus: row.agreementStatus,
      mouStatus: row.mouStatus,
      mouStart: mouStart ? CalendarDate.fromISO(mouStart) : null,
      mouEnd: mouEnd ? CalendarDate.fromISO(mouEnd) : null,
      mouStartOverride: row.mouStartOverride
        ? CalendarDate.fromISO(row.mouStartOverride)
        : null,
      mouEndOverride: row.mouEndOverride
        ? CalendarDate.fromISO(row.mouEndOverride)
        : null,
      types: [...row.types],
      financialReportingType: row.financialReportingType ?? null,
      primary: row.primary,
      mou: row.mouId ? { id: row.mouId } : null,
      agreement: row.agreementId ? { id: row.agreementId } : null,
      // `changeset` is a resolver navigation marker — PCR is excluded so it
      // stays undefined.
      changeset: undefined,
      canDelete: true,
      // The requester's project-scoped roles — `member` policy conditions
      // read these for field-level permissions.
      scope,
      // Required by the `parent` field on the DTO. The service constructs a
      // BaseNode-shaped object; here we just pass the project id through.
      parent: {
        id: row.project.id,
        __typename: `${row.project.type}Project`,
      },
    };
    return dto as UnsecuredDto<Partnership>;
  }
}

/**
 * Sortable columns on `partnerships` itself. Cross-domain sort (`partner.*`)
 * is resolved inline in `list()` via a hand-rolled INNER JOIN — same pattern
 * as Partner's `organization.*` and Project's `primaryLocation.*` /
 * `fieldRegion.*`. See the migration-todo in `list()` for the abstraction
 * opportunity at the now-third consumer.
 */
export const partnershipSortColumns = {
  createdAt: partnerships.createdAt,
  primary: partnerships.primary,
  agreementStatus: partnerships.agreementStatus,
  mouStatus: partnerships.mouStatus,
} satisfies SortMap<keyof Partnership>;

/**
 * Build the column-level WHERE clauses for a `PartnershipFilters` input
 * against the `partnerships` table. Reusable from sub-filters in other
 * domains (e.g. Project's `partnerships` / `primaryPartnership` once those
 * stop being NotImplementedException stubs).
 */
export const partnershipFilterClauses = (
  db: DrizzleDb,
  filter: PartnershipFilters | undefined,
): SQL[] => {
  const conditions: SQL[] = [];
  if (!filter) return conditions;
  if (filter.projectId) {
    conditions.push(eq(partnerships.projectId, filter.projectId));
  }
  if (filter.types?.length) {
    const typesLiteral = sql.raw(
      `array[${filter.types.map((t) => `'${t}'`).join(', ')}]::"partner_type"[]`,
    );
    conditions.push(sql`${partnerships.types} && ${typesLiteral}`);
  }
  if (filter.partner) {
    conditions.push(
      subFilter(
        db,
        partnerships.partnerId,
        partners,
        partnerFilterClauses(db, filter.partner),
      ),
    );
  }
  return conditions;
};
