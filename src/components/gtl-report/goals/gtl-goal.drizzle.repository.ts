import { Injectable } from '@nestjs/common';
import { and, asc, desc, eq, inArray, isNull, type SQL } from 'drizzle-orm';
import { DateTime } from 'luxon';
import { CalendarDate, generateId, type ID, type UnsecuredDto } from '~/common';
import { DrizzleDtoRepository, DrizzleService } from '~/core/drizzle';
import {
  engagements,
  gtlGoalProgress,
  gtlGoals,
  projects,
} from '~/core/drizzle/schema';
import {
  type CreateGtlGoal,
  GtlGoal,
  type ReportGtlGoalProgress,
  type UpdateGtlGoal,
} from '../dto';
import {
  goalPercentComplete,
  goalScheduleStatus,
} from './gtl-goal-progress.util';

type Row = typeof gtlGoals.$inferSelect & { sensitivity?: string };

@Injectable()
export class GtlGoalDrizzleRepository extends DrizzleDtoRepository<
  typeof gtlGoals,
  GtlGoal
> {
  constructor(db: DrizzleService) {
    super(db, gtlGoals, GtlGoal);
  }

  protected toDto(row: Row): UnsecuredDto<GtlGoal> {
    const dto: unknown = {
      id: row.id,
      engagement: { id: row.engagementId },
      setInReport: row.setInReportId ? { id: row.setInReportId } : null,
      goal: row.goal,
      details: row.details,
      targetDate: row.targetDate ? CalendarDate.fromISO(row.targetDate) : null,
      measurement: row.measurement,
      targetNumber: row.targetNumber,
      targetDescription: row.targetDescription,
      progressValue: row.progressValue,
      status: row.status,
      percentComplete: goalPercentComplete(row),
      scheduleStatus: goalScheduleStatus(row),
      order: row.order,
      sensitivity: row.sensitivity ?? 'High',
      createdAt: DateTime.fromJSDate(row.createdAt),
      modifiedAt: DateTime.fromJSDate(row.modifiedAt),
    };
    return dto as UnsecuredDto<GtlGoal>;
  }

  /** Goals joined to their owning project's sensitivity. */
  private selectGoals(predicate: SQL | undefined) {
    return this.db
      .select({ goal: gtlGoals, sensitivity: projects.sensitivity })
      .from(gtlGoals)
      .innerJoin(engagements, eq(engagements.id, gtlGoals.engagementId))
      .innerJoin(projects, eq(projects.id, engagements.projectId))
      .where(predicate);
  }

  private hydrate(
    rows: Array<{ goal: typeof gtlGoals.$inferSelect; sensitivity: string }>,
  ) {
    return rows.map((r) =>
      this.toDto({ ...r.goal, sensitivity: r.sensitivity }),
    );
  }

  override async readMany(ids: readonly ID[]) {
    return this.hydrate(
      await this.selectGoals(
        and(inArray(gtlGoals.id, [...ids]), isNull(gtlGoals.deletedAt)),
      ),
    );
  }

  /** The engagement's whole growth plan, target date first. */
  async listForEngagement(engagementId: ID) {
    return this.hydrate(
      await this.selectGoals(
        and(
          eq(gtlGoals.engagementId, engagementId as ID<'Engagement'>),
          isNull(gtlGoals.deletedAt),
        ),
      ).orderBy(
        asc(gtlGoals.order),
        asc(gtlGoals.targetDate),
        asc(gtlGoals.id),
      ),
    );
  }

  /** Goals first proposed in a given report. */
  async listSetInReport(reportId: ID) {
    return this.hydrate(
      await this.selectGoals(
        and(
          eq(gtlGoals.setInReportId, reportId as ID<'GTLReport'>),
          isNull(gtlGoals.deletedAt),
        ),
      ).orderBy(asc(gtlGoals.order), asc(gtlGoals.id)),
    );
  }

  async create(input: CreateGtlGoal) {
    const id = await generateId<ID<'GtlGoal'>>();
    await this.db.insert(gtlGoals).values({
      id,
      engagementId: input.engagement as ID<'Engagement'>,
      setInReportId: (input.setInReport ?? null) as ID<'GTLReport'> | null,
      goal: input.goal,
      details: input.details ?? null,
      targetDate: input.targetDate?.toISODate() ?? null,
      measurement: input.measurement ?? 'Boolean',
      targetNumber: input.targetNumber ?? null,
      targetDescription: input.targetDescription ?? null,
      order: input.order ?? 0,
    });
    return await this.readOne(id);
  }

  async update(input: UpdateGtlGoal) {
    await this.updateColumns(input.id, {
      ...(input.goal !== undefined && { goal: input.goal }),
      ...(input.details !== undefined && { details: input.details }),
      ...(input.targetDate !== undefined && {
        targetDate: input.targetDate?.toISODate() ?? null,
      }),
      ...(input.measurement !== undefined && {
        measurement: input.measurement,
      }),
      ...(input.targetNumber !== undefined && {
        targetNumber: input.targetNumber,
      }),
      ...(input.targetDescription !== undefined && {
        targetDescription: input.targetDescription,
      }),
      ...(input.order !== undefined && { order: input.order }),
      modifiedAt: new Date(),
    });
    return await this.readOne(input.id);
  }

  async delete(id: ID) {
    await this.softDelete(id);
  }

  // ── Progress ─────────────────────────────────────────────────────────────

  /**
   * Upsert this report's entry for a goal, and refresh the goal's cached
   * status — but only when this is the most recent entry, so backfilling an
   * earlier quarter cannot regress the goal's current state.
   */
  async reportProgress(input: ReportGtlGoalProgress, progressDate: string) {
    const newId = await generateId<ID<'GtlGoalProgress'>>();
    return await this.db.transaction(async (tx) => {
      // A goal gets one entry per report, so re-saving the same quarter updates
      // in place. `returning` is what makes that safe: on conflict the row that
      // comes back is the existing one, keeping its own id — returning the id we
      // just generated would name a row that was never inserted.
      const [row] = await tx
        .insert(gtlGoalProgress)
        .values({
          id: newId,
          goalId: input.goal as ID<'GtlGoal'>,
          reportId: input.report as ID<'GTLReport'>,
          status: input.status,
          progressValue: input.progressValue ?? null,
          notes: input.notes ?? null,
          progressDate,
        })
        .onConflictDoUpdate({
          target: [gtlGoalProgress.goalId, gtlGoalProgress.reportId],
          // The unique index is partial (live rows only), so the conflict
          // target has to carry the same predicate or Postgres won't match it.
          targetWhere: isNull(gtlGoalProgress.deletedAt),
          set: {
            status: input.status,
            progressValue: input.progressValue ?? null,
            notes: input.notes ?? null,
            progressDate,
            modifiedAt: new Date(),
            updatedAt: new Date(),
          },
        })
        .returning({ id: gtlGoalProgress.id });

      const [latest] = await tx
        .select({
          status: gtlGoalProgress.status,
          progressValue: gtlGoalProgress.progressValue,
        })
        .from(gtlGoalProgress)
        .where(
          and(
            eq(gtlGoalProgress.goalId, input.goal as ID<'GtlGoal'>),
            isNull(gtlGoalProgress.deletedAt),
          ),
        )
        .orderBy(
          desc(gtlGoalProgress.progressDate),
          desc(gtlGoalProgress.createdAt),
        )
        .limit(1);

      if (latest) {
        await tx
          .update(gtlGoals)
          .set({
            status: latest.status,
            progressValue: latest.progressValue,
            updatedAt: new Date(),
          })
          .where(eq(gtlGoals.id, input.goal as ID<'GtlGoal'>));
      }

      return row!.id;
    });
  }

  async listProgressForReport(reportId: ID) {
    return await this.db
      .select()
      .from(gtlGoalProgress)
      .where(
        and(
          eq(gtlGoalProgress.reportId, reportId as ID<'GTLReport'>),
          isNull(gtlGoalProgress.deletedAt),
        ),
      )
      .orderBy(asc(gtlGoalProgress.createdAt));
  }

  async readProgress(id: ID) {
    const [row] = await this.db
      .select()
      .from(gtlGoalProgress)
      .where(eq(gtlGoalProgress.id, id as ID<'GtlGoalProgress'>));
    return row ?? null;
  }
}
