import { Injectable } from '@nestjs/common';
import {
  and,
  asc,
  desc,
  eq,
  getTableColumns,
  inArray,
  isNull,
  type SQL,
  sql,
} from 'drizzle-orm';
import { DateTime } from 'luxon';
import {
  CalendarDate,
  EnhancedResource,
  generateId,
  type ID,
  NotFoundException,
  type Sensitivity,
  type UnsecuredDto,
} from '~/common';
import { Identity } from '~/core/authentication';
import { DrizzleDtoRepository, DrizzleService } from '~/core/drizzle';
import {
  engagements,
  gtlGoalProgress,
  gtlGoals,
  periodicReports,
  projects,
} from '~/core/drizzle/schema';
import { type ScopedRole } from '../../authorization/dto/role.dto';
import { PolicyExecutor } from '../../authorization/policy/executor/policy-executor';
import { InternshipEngagement } from '../../engagement/dto';
import { requesterScopeByProject } from '../../project/project-member/membership-scope';
import {
  type CreateGtlGoal,
  GtlGoal,
  GtlGoalProgress,
  type GtlGoalStatus,
  GTLReport,
  type ReportGtlGoalProgress,
  type UpdateGtlGoal,
} from '../dto';
import {
  goalPercentComplete,
  goalScheduleStatus,
} from './gtl-goal-progress.util';

type GoalRow = typeof gtlGoals.$inferSelect & {
  projectId: ID<'Project'>;
  sensitivity: Sensitivity;
  /** The latest live entry on a live report, or nulls when there is none. */
  latestStatus: GtlGoalStatus | null;
  latestValue: number | null;
  latestDate: string | null;
};

type ProgressRow = typeof gtlGoalProgress.$inferSelect & {
  projectId: ID<'Project'>;
  sensitivity: Sensitivity;
};

/**
 * What a `create` needs to know about the engagement before the goal exists:
 * the requester's membership and the project's sensitivity, for the policy
 * conditions, plus the type, since goals belong to Internship engagements.
 */
export interface EngagementContext {
  id: ID<'InternshipEngagement'>;
  type: 'Language' | 'Internship';
  sensitivity: Sensitivity;
  scope: readonly ScopedRole[];
}

/** The same for the report a progress entry is filed in; only live GTL reports. */
export interface ReportContext {
  id: ID<'GTLReport'>;
  engagementId: ID<'InternshipEngagement'>;
  /** The period end, ISO date — the default `progressDate`. */
  end: string;
  sensitivity: Sensitivity;
  scope: readonly ScopedRole[];
}

/**
 * Goals and their quarterly progress entries.
 *
 * The goal's current `status`/`progressValue` are never stored on `gtl_goals`.
 * Every goal read joins the latest LIVE entry on a LIVE GTL report (a
 * `DISTINCT ON (goal_id)` subquery ordered newest first), so soft-deleting an
 * entry or a report can't leave a stale value behind. With no entry the goal
 * falls back to its own `status` column (Planned by default) and a null value.
 *
 * Liveness: every read filters `deleted_at` on goals, entries and the joined
 * reports, and on the engagement and project above them — none of those soft
 * deletes cascade down.
 *
 * Permission: the list reads apply the read policy as SQL
 * (`PolicyExecutor.applyReadFilter`), so a non-member of the project gets an
 * empty list rather than a page of redacted rows. By-id reads, which only the
 * mutations and the `GtlGoalProgress.goal` field reach, are not filtered — the
 * service's `verifyCan` then answers with the permission error rather than
 * "not found", the same split the GTL report itself has.
 */
@Injectable()
export class GtlGoalRepository extends DrizzleDtoRepository<
  typeof gtlGoals,
  GtlGoal
> {
  private readonly progressResource = EnhancedResource.of(GtlGoalProgress);

  constructor(
    db: DrizzleService,
    private readonly identity: Identity,
    private readonly executor: PolicyExecutor,
  ) {
    super(db, gtlGoals, GtlGoal);
  }

  // ── Goals ────────────────────────────────────────────────────────────────

  override async readMany(
    ids: readonly ID[],
  ): Promise<Array<UnsecuredDto<GtlGoal>>> {
    if (ids.length === 0) return [];
    const rows = await this.selectGoals(
      this.goalConditions(
        inArray(gtlGoals.id, [...ids] as Array<ID<'GtlGoal'>>),
      ),
    );
    return await this.hydrateGoals(rows);
  }

  /** The engagement's whole growth plan, in plan order then by target date. */
  async listForEngagement(
    engagementId: ID,
  ): Promise<Array<UnsecuredDto<GtlGoal>>> {
    const conditions = this.goalConditions(
      eq(gtlGoals.engagementId, engagementId as ID<'InternshipEngagement'>),
    );
    if (!this.executor.applyReadFilter(this.resource, conditions)) {
      return [];
    }
    const rows = await this.selectGoals(conditions).orderBy(
      asc(gtlGoals.order),
      asc(gtlGoals.targetDate),
      asc(gtlGoals.id),
    );
    return await this.hydrateGoals(rows);
  }

  /** Goals first proposed in a given report. */
  async listSetInReport(reportId: ID): Promise<Array<UnsecuredDto<GtlGoal>>> {
    const conditions = this.goalConditions(
      eq(gtlGoals.setInReportId, reportId as ID<'GTLReport'>),
    );
    if (!this.executor.applyReadFilter(this.resource, conditions)) {
      return [];
    }
    const rows = await this.selectGoals(conditions).orderBy(
      asc(gtlGoals.order),
      asc(gtlGoals.targetDate),
      asc(gtlGoals.id),
    );
    return await this.hydrateGoals(rows);
  }

  private goalConditions(...narrowing: SQL[]): SQL[] {
    return [
      isNull(gtlGoals.deletedAt),
      isNull(engagements.deletedAt),
      isNull(projects.deletedAt),
      ...narrowing,
    ];
  }

  /**
   * One WHERE array for everything; chaining a second `.where()` would REPLACE
   * this clause and silently drop the read filter.
   */
  private selectGoals(conditions: SQL[]) {
    const latest = this.latestEntries();
    return (
      this.db
        .select({
          ...getTableColumns(gtlGoals),
          // For the requester's membership scope and the sensitivity condition.
          projectId: projects.id,
          sensitivity: projects.sensitivity,
          latestStatus: latest.status,
          latestValue: latest.progressValue,
          latestDate: latest.progressDate,
        })
        .from(gtlGoals)
        .innerJoin(engagements, eq(engagements.id, gtlGoals.engagementId))
        .innerJoin(projects, eq(projects.id, engagements.projectId))
        // LATERAL: the subquery is correlated on the goal, so it is one indexed
        // lookup per goal in the page rather than a pass over every entry.
        .leftJoinLateral(latest, sql`true`)
        .where(and(...conditions))
    );
  }

  /**
   * The most recent live entry for the goal in scope (`gtl_goals.id` from the
   * outer query), counting only entries on live GTL reports. Newest
   * `progress_date` wins; `created_at` breaks a tie between two entries dated
   * the same day.
   */
  private latestEntries() {
    return this.db
      .select({
        status: gtlGoalProgress.status,
        progressValue: gtlGoalProgress.progressValue,
        progressDate: gtlGoalProgress.progressDate,
      })
      .from(gtlGoalProgress)
      .innerJoin(
        periodicReports,
        and(
          eq(periodicReports.id, gtlGoalProgress.reportId),
          eq(periodicReports.type, 'GTL'),
          isNull(periodicReports.deletedAt),
        ),
      )
      .where(
        and(
          eq(gtlGoalProgress.goalId, gtlGoals.id),
          isNull(gtlGoalProgress.deletedAt),
        ),
      )
      .orderBy(
        desc(gtlGoalProgress.progressDate),
        desc(gtlGoalProgress.createdAt),
      )
      .limit(1)
      .as('latest');
  }

  private async hydrateGoals(rows: GoalRow[]) {
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
    row: GoalRow,
    scope: readonly ScopedRole[] = [],
  ): UnsecuredDto<GtlGoal> {
    // The latest quarter's word, else the goal's own initial state.
    const status = row.latestStatus ?? row.status;
    const progressValue = row.latestStatus ? row.latestValue : null;
    const dto: unknown = {
      id: row.id,
      engagement: { id: row.engagementId },
      setInReport: row.setInReportId ? { id: row.setInReportId } : null,
      goal: row.goal,
      details: row.details ?? null,
      targetDate: row.targetDate ? CalendarDate.fromISO(row.targetDate) : null,
      measurement: row.measurement,
      targetNumber: row.targetNumber,
      targetDescription: row.targetDescription,
      progressValue,
      status,
      percentComplete: goalPercentComplete({
        measurement: row.measurement,
        status,
        progressValue,
        targetNumber: row.targetNumber,
      }),
      scheduleStatus: goalScheduleStatus({
        status,
        targetDate: row.targetDate,
        // Only meaningful when that entry is the one that marked it Done.
        doneOn: status === 'Done' ? row.latestDate : null,
      }),
      order: row.order,
      sensitivity: row.sensitivity,
      scope,
      createdAt: DateTime.fromJSDate(row.createdAt),
    };
    return dto as UnsecuredDto<GtlGoal>;
  }

  async create(
    input: CreateGtlGoal & {
      targetNumber: number | null;
      targetDescription: string | null;
    },
  ): Promise<UnsecuredDto<GtlGoal>> {
    const id = await generateId<ID<'GtlGoal'>>();
    await this.db.insert(gtlGoals).values({
      id,
      engagementId: input.engagement,
      setInReportId: input.setInReport ?? null,
      goal: input.goal,
      details: input.details ?? null,
      targetDate: input.targetDate?.toISODate() ?? null,
      measurement: input.measurement ?? 'Boolean',
      targetNumber: input.targetNumber,
      targetDescription: input.targetDescription,
      order: input.order ?? 0,
    });
    // A new goal changes the engagement's summary; nothing watches the goal yet.
    this.liveQueryStore.invalidate([InternshipEngagement, input.engagement]);
    return await this.readOne(id);
  }

  async update(
    input: UpdateGtlGoal & {
      targetNumber: number | null;
      targetDescription: string | null;
    },
    engagementId: ID<'InternshipEngagement'>,
  ): Promise<UnsecuredDto<GtlGoal>> {
    await this.updateColumns(input.id, {
      goal: input.goal,
      details: input.details,
      targetDate:
        input.targetDate !== undefined
          ? (input.targetDate?.toISODate() ?? null)
          : undefined,
      measurement: input.measurement,
      targetNumber: input.targetNumber,
      targetDescription: input.targetDescription,
      order: input.order,
      modifiedAt: new Date(),
    });
    this.liveQueryStore.invalidate([InternshipEngagement, engagementId]);
    return await this.readOne(input.id);
  }

  /**
   * Soft delete. The goal's progress entries are left as they are: every
   * progress read joins the goal and requires it live, so they disappear with
   * it, and would come back with it if the goal were ever restored.
   */
  async delete(id: ID, engagementId: ID<'InternshipEngagement'>) {
    await this.softDelete(id);
    this.liveQueryStore.invalidate([InternshipEngagement, engagementId]);
  }

  // ── Parent contexts for creates ──────────────────────────────────────────

  /** Unfiltered: the caller decides what to say about an engagement it can't act on. */
  async readEngagementContext(id: ID): Promise<EngagementContext | null> {
    const [row] = await this.db
      .select({
        id: engagements.id,
        type: engagements.type,
        projectId: projects.id,
        sensitivity: projects.sensitivity,
      })
      .from(engagements)
      .innerJoin(projects, eq(projects.id, engagements.projectId))
      .where(
        and(
          eq(engagements.id, id as ID<'Engagement'>),
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
      id: row.id as ID<'InternshipEngagement'>,
      type: row.type,
      sensitivity: row.sensitivity,
      scope: scope.get(row.projectId) ?? [],
    };
  }

  /** Null unless the id is a live GTL report on a live engagement and project. */
  async readReportContext(id: ID): Promise<ReportContext | null> {
    const [row] = await this.db
      .select({
        id: periodicReports.id,
        engagementId: periodicReports.engagementId,
        end: periodicReports.end,
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
      // The parent-shape CHECK guarantees a GTL row has an engagement.
      engagementId: row.engagementId! as ID<'InternshipEngagement'>,
      end: row.end,
      sensitivity: row.sensitivity,
      scope: scope.get(row.projectId) ?? [],
    };
  }

  // ── Progress ─────────────────────────────────────────────────────────────

  async readProgress(id: ID): Promise<UnsecuredDto<GtlGoalProgress>> {
    const rows = await this.selectProgress(
      this.progressConditions(
        eq(gtlGoalProgress.id, id as ID<'GtlGoalProgress'>),
      ),
    );
    const [dto] = await this.hydrateProgress(rows);
    if (!dto) {
      throw new NotFoundException('Could not find progress entry');
    }
    return dto;
  }

  /** This report's live entry for the goal, if one exists. */
  async findProgress(
    goalId: ID<'GtlGoal'>,
    reportId: ID<'GTLReport'>,
  ): Promise<UnsecuredDto<GtlGoalProgress> | null> {
    const rows = await this.selectProgress(
      this.progressConditions(
        eq(gtlGoalProgress.goalId, goalId),
        eq(gtlGoalProgress.reportId, reportId),
      ),
    );
    const [dto] = await this.hydrateProgress(rows);
    return dto ?? null;
  }

  /** What one report said about each goal, in the plan's order. */
  async listProgressForReport(
    reportId: ID,
  ): Promise<Array<UnsecuredDto<GtlGoalProgress>>> {
    const conditions = this.progressConditions(
      eq(gtlGoalProgress.reportId, reportId as ID<'GTLReport'>),
    );
    if (!this.executor.applyReadFilter(this.progressResource, conditions)) {
      return [];
    }
    const rows = await this.selectProgress(conditions).orderBy(
      asc(gtlGoals.order),
      asc(gtlGoals.targetDate),
      asc(gtlGoals.id),
    );
    return await this.hydrateProgress(rows);
  }

  private progressConditions(...narrowing: SQL[]): SQL[] {
    return [
      isNull(gtlGoalProgress.deletedAt),
      isNull(gtlGoals.deletedAt),
      eq(periodicReports.type, 'GTL'),
      isNull(periodicReports.deletedAt),
      isNull(engagements.deletedAt),
      isNull(projects.deletedAt),
      ...narrowing,
    ];
  }

  private selectProgress(conditions: SQL[]) {
    return this.db
      .select({
        ...getTableColumns(gtlGoalProgress),
        projectId: projects.id,
        sensitivity: projects.sensitivity,
      })
      .from(gtlGoalProgress)
      .innerJoin(gtlGoals, eq(gtlGoals.id, gtlGoalProgress.goalId))
      .innerJoin(
        periodicReports,
        eq(periodicReports.id, gtlGoalProgress.reportId),
      )
      .innerJoin(engagements, eq(engagements.id, gtlGoals.engagementId))
      .innerJoin(projects, eq(projects.id, engagements.projectId))
      .where(and(...conditions));
  }

  private async hydrateProgress(rows: ProgressRow[]) {
    const scopeByProject = await requesterScopeByProject(
      this.db,
      this.identity.current.userId,
      rows.map((row) => row.projectId),
    );
    return rows.map((row) =>
      this.toProgressDto(row, scopeByProject.get(row.projectId) ?? []),
    );
  }

  private toProgressDto(
    row: ProgressRow,
    scope: readonly ScopedRole[],
  ): UnsecuredDto<GtlGoalProgress> {
    const dto: unknown = {
      id: row.id,
      goal: { id: row.goalId },
      report: { id: row.reportId },
      status: row.status,
      progressValue: row.progressValue,
      notes: row.notes ?? null,
      progressDate: CalendarDate.fromISO(row.progressDate),
      sensitivity: row.sensitivity,
      scope,
      createdAt: DateTime.fromJSDate(row.createdAt),
    };
    return dto as UnsecuredDto<GtlGoalProgress>;
  }

  /**
   * Upsert this report's entry for the goal. A goal gets one live entry per
   * report, so re-saving the same quarter updates in place. `returning` is what
   * makes that safe: on conflict the row that comes back is the existing one,
   * keeping its own id — returning the id we just generated would name a row
   * that was never inserted.
   */
  async reportProgress(
    input: ReportGtlGoalProgress,
    progressDate: string,
    engagementId: ID<'InternshipEngagement'>,
  ): Promise<ID<'GtlGoalProgress'>> {
    const newId = await generateId<ID<'GtlGoalProgress'>>();
    const now = new Date();
    const [row] = await this.db
      .insert(gtlGoalProgress)
      .values({
        id: newId,
        goalId: input.goal,
        reportId: input.report,
        status: input.status,
        progressValue: input.progressValue ?? null,
        notes: input.notes ?? null,
        progressDate,
      })
      .onConflictDoUpdate({
        target: [gtlGoalProgress.goalId, gtlGoalProgress.reportId],
        // The unique index is partial (live rows only), so the conflict target
        // has to carry the same predicate or Postgres won't match it.
        targetWhere: isNull(gtlGoalProgress.deletedAt),
        set: {
          status: input.status,
          progressValue: input.progressValue ?? null,
          notes: input.notes ?? null,
          progressDate,
          modifiedAt: now,
          updatedAt: now,
        },
      })
      .returning({ id: gtlGoalProgress.id });
    const id = row!.id;
    // Hand-rolled write, so the live-query store is told here: the entry (when
    // it already existed), the goal whose derived status may have changed, the
    // report listing it, and the engagement whose summary rolls it up.
    if (id !== newId) {
      this.liveQueryStore.invalidate([GtlGoalProgress, id]);
    }
    this.liveQueryStore.invalidate([GtlGoal, input.goal]);
    this.liveQueryStore.invalidate([GTLReport, input.report]);
    this.liveQueryStore.invalidate([InternshipEngagement, engagementId]);
    return id;
  }
}
