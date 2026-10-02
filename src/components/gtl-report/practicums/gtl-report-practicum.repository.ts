import { Injectable } from '@nestjs/common';
import {
  and,
  asc,
  eq,
  getTableColumns,
  inArray,
  isNull,
  type SQL,
} from 'drizzle-orm';
import { DateTime } from 'luxon';
import {
  generateId,
  type ID,
  type Sensitivity,
  type UnsecuredDto,
} from '~/common';
import { Identity } from '~/core/authentication';
import { DrizzleDtoRepository, DrizzleService } from '~/core/drizzle';
import {
  engagements,
  gtlReportPracticums,
  periodicReports,
  projects,
  users,
} from '~/core/drizzle/schema';
import { type ScopedRole } from '../../authorization/dto/role.dto';
import { PolicyExecutor } from '../../authorization/policy/executor/policy-executor';
import { requesterScopeByProject } from '../../project/project-member/membership-scope';
import {
  type CreateGtlReportPracticum,
  GTLReport,
  GtlReportPracticum,
  type UpdateGtlReportPracticum,
} from '../dto';

type Row = typeof gtlReportPracticums.$inferSelect & {
  projectId: ID<'Project'>;
  sensitivity: Sensitivity;
};

/**
 * What a `create` needs to know about the report before the practicum exists:
 * the requester's membership and the project's sensitivity, for the policy
 * conditions. Only live GTL reports on live engagements and projects.
 */
export interface PracticumReportContext {
  id: ID<'GTLReport'>;
  sensitivity: Sensitivity;
  scope: readonly ScopedRole[];
}

/**
 * Practicum and workshop involvement, several rows per GTL report.
 *
 * Every read joins the report, engagement and project above the row and
 * requires all of them live — none of those soft deletes cascade down. The
 * list read applies the read policy as SQL (`PolicyExecutor.applyReadFilter`),
 * so a non-member gets an empty section rather than redacted rows; the by-id
 * reads the mutations use are not filtered, so the service's `verifyCan`
 * answers with the permission error rather than "not found".
 */
@Injectable()
export class GtlReportPracticumRepository extends DrizzleDtoRepository<
  typeof gtlReportPracticums,
  GtlReportPracticum
> {
  constructor(
    db: DrizzleService,
    private readonly identity: Identity,
    private readonly executor: PolicyExecutor,
  ) {
    super(db, gtlReportPracticums, GtlReportPracticum);
  }

  override async readMany(
    ids: readonly ID[],
  ): Promise<Array<UnsecuredDto<GtlReportPracticum>>> {
    if (ids.length === 0) return [];
    const rows = await this.select(
      this.conditions(
        inArray(gtlReportPracticums.id, [...ids] as Array<
          ID<'GtlReportPracticum'>
        >),
      ),
    );
    return await this.hydrate(rows);
  }

  /** The report's practicums in their given order. */
  async listForReport(
    reportId: ID,
  ): Promise<Array<UnsecuredDto<GtlReportPracticum>>> {
    const conditions = this.conditions(
      eq(gtlReportPracticums.reportId, reportId as ID<'GTLReport'>),
    );
    if (!this.executor.applyReadFilter(this.resource, conditions)) {
      return [];
    }
    const rows = await this.select(conditions).orderBy(
      asc(gtlReportPracticums.order),
      asc(gtlReportPracticums.createdAt),
      asc(gtlReportPracticums.id),
    );
    return await this.hydrate(rows);
  }

  private conditions(...narrowing: SQL[]): SQL[] {
    return [
      isNull(gtlReportPracticums.deletedAt),
      eq(periodicReports.type, 'GTL'),
      isNull(periodicReports.deletedAt),
      isNull(engagements.deletedAt),
      isNull(projects.deletedAt),
      ...narrowing,
    ];
  }

  /**
   * One WHERE array for everything; chaining a second `.where()` would REPLACE
   * this clause and silently drop the read filter.
   */
  private select(conditions: SQL[]) {
    return this.db
      .select({
        ...getTableColumns(gtlReportPracticums),
        // For the requester's membership scope and the sensitivity condition.
        projectId: projects.id,
        sensitivity: projects.sensitivity,
      })
      .from(gtlReportPracticums)
      .innerJoin(
        periodicReports,
        eq(periodicReports.id, gtlReportPracticums.reportId),
      )
      .innerJoin(engagements, eq(engagements.id, periodicReports.engagementId))
      .innerJoin(projects, eq(projects.id, engagements.projectId))
      .where(and(...conditions));
  }

  private async hydrate(rows: Row[]) {
    const scopeByProject = await requesterScopeByProject(
      this.db,
      this.identity.current.userId,
      rows.map((row) => row.projectId),
    );
    return rows.map((row) =>
      this.toDto(row, scopeByProject.get(row.projectId) ?? []),
    );
  }

  protected toDto(
    row: Row,
    scope: readonly ScopedRole[] = [],
  ): UnsecuredDto<GtlReportPracticum> {
    const dto: unknown = {
      id: row.id,
      report: { id: row.reportId },
      involvement: row.involvement,
      mentor: row.mentorId ? { id: row.mentorId } : null,
      outcomes: row.outcomes ?? null,
      order: row.order,
      sensitivity: row.sensitivity,
      scope,
      createdAt: DateTime.fromJSDate(row.createdAt),
    };
    return dto as UnsecuredDto<GtlReportPracticum>;
  }

  async create(
    input: CreateGtlReportPracticum,
  ): Promise<UnsecuredDto<GtlReportPracticum>> {
    const id = await generateId<ID<'GtlReportPracticum'>>();
    await this.db.insert(gtlReportPracticums).values({
      id,
      reportId: input.report,
      involvement: input.involvement,
      mentorId: input.mentor ?? null,
      outcomes: input.outcomes ?? null,
      order: input.order ?? 0,
    });
    // Nothing watches the new row yet; the report's section list changed.
    this.liveQueryStore.invalidate([GTLReport, input.report]);
    return await this.readOne(id);
  }

  async update(
    input: UpdateGtlReportPracticum,
    reportId: ID<'GTLReport'>,
  ): Promise<UnsecuredDto<GtlReportPracticum>> {
    await this.updateColumns(input.id, {
      involvement: input.involvement,
      mentorId: input.mentor,
      outcomes: input.outcomes,
      order: input.order,
      modifiedAt: new Date(),
    });
    this.liveQueryStore.invalidate([GTLReport, reportId]);
    return await this.readOne(input.id);
  }

  async delete(id: ID, reportId: ID<'GTLReport'>) {
    await this.softDelete(id);
    this.liveQueryStore.invalidate([GTLReport, reportId]);
  }

  // ── Parent context for creates ───────────────────────────────────────────

  /**
   * Null unless the id is a live GTL report on a live engagement and project.
   * Unfiltered by permission: the caller decides what to say about a report
   * the requester can't act on.
   */
  async readReportContext(id: ID): Promise<PracticumReportContext | null> {
    const [row] = await this.db
      .select({
        id: periodicReports.id,
        projectId: projects.id,
        sensitivity: projects.sensitivity,
      })
      .from(periodicReports)
      .innerJoin(engagements, eq(engagements.id, periodicReports.engagementId))
      .innerJoin(projects, eq(projects.id, engagements.projectId))
      .where(
        and(
          eq(periodicReports.id, id),
          eq(periodicReports.type, 'GTL'),
          isNull(periodicReports.deletedAt),
          isNull(engagements.deletedAt),
          isNull(projects.deletedAt),
        ),
      );
    if (!row) return null;
    const scope = await requesterScopeByProject(
      this.db,
      this.identity.current.userId,
      [row.projectId],
    );
    return {
      id: row.id as ID<'GTLReport'>,
      sensitivity: row.sensitivity,
      scope: scope.get(row.projectId) ?? [],
    };
  }

  /** Whether a live user exists with this id — the mentor must be a real person. */
  async userExists(id: ID<'User'>): Promise<boolean> {
    const [row] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, id), isNull(users.deletedAt)))
      .limit(1);
    return !!row;
  }
}
