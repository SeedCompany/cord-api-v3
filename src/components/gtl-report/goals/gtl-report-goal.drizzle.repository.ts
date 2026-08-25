import { Injectable } from '@nestjs/common';
import { and, asc, eq, inArray, isNull, type SQL } from 'drizzle-orm';
import { DateTime } from 'luxon';
import { generateId, type ID, type UnsecuredDto } from '~/common';
import { DrizzleDtoRepository, DrizzleService } from '~/core/drizzle';
import {
  engagements,
  gtlReportGoals,
  periodicReports,
  projects,
} from '~/core/drizzle/schema';
import {
  type CreateGtlReportGoal,
  GtlReportGoal,
  type ReviewGtlReportGoal,
  type UpdateGtlReportGoal,
} from '../dto';

type Row = typeof gtlReportGoals.$inferSelect & { sensitivity?: string };

@Injectable()
export class GtlReportGoalDrizzleRepository extends DrizzleDtoRepository<
  typeof gtlReportGoals,
  GtlReportGoal
> {
  constructor(db: DrizzleService) {
    super(db, gtlReportGoals, GtlReportGoal);
  }

  protected toDto(row: Row): UnsecuredDto<GtlReportGoal> {
    const dto: unknown = {
      id: row.id,
      setInReport: { id: row.setInReportId },
      reviewedInReport: row.reviewedInReportId
        ? { id: row.reviewedInReportId }
        : null,
      goal: row.goal,
      details: row.details,
      order: row.order,
      met: row.met,
      impact: row.impact,
      sensitivity: row.sensitivity ?? 'High',
      createdAt: DateTime.fromJSDate(row.createdAt),
      modifiedAt: DateTime.fromJSDate(row.modifiedAt),
    };
    return dto as UnsecuredDto<GtlReportGoal>;
  }

  /**
   * Rows joined to their owning project's sensitivity.
   *
   * Both report joins filter `deleted_at`: a report revived after a date-range
   * change comes back with a fresh id (migration 0035), so a goal can point at
   * a dead row and must not resurface through it.
   */
  private selectWithSensitivity(predicate: SQL | undefined) {
    return this.db
      .select({
        goal: gtlReportGoals,
        sensitivity: projects.sensitivity,
      })
      .from(gtlReportGoals)
      .innerJoin(
        periodicReports,
        and(
          eq(periodicReports.id, gtlReportGoals.setInReportId),
          isNull(periodicReports.deletedAt),
        ),
      )
      .innerJoin(engagements, eq(engagements.id, periodicReports.engagementId))
      .innerJoin(projects, eq(projects.id, engagements.projectId))
      .where(predicate);
  }

  private hydrate(
    rows: Array<{
      goal: typeof gtlReportGoals.$inferSelect;
      sensitivity: string;
    }>,
  ) {
    return rows.map((r) =>
      this.toDto({ ...r.goal, sensitivity: r.sensitivity }),
    );
  }

  override async readMany(ids: readonly ID[]) {
    const rows = await this.selectWithSensitivity(
      and(
        inArray(gtlReportGoals.id, [...ids]),
        isNull(gtlReportGoals.deletedAt),
      ),
    );
    return this.hydrate(rows);
  }

  /** Goals SET in a report — i.e. the goals for the coming quarter. */
  async listSetIn(reportId: ID) {
    const rows = await this.selectWithSensitivity(
      and(
        eq(gtlReportGoals.setInReportId, reportId),
        isNull(gtlReportGoals.deletedAt),
      ),
    ).orderBy(asc(gtlReportGoals.order), asc(gtlReportGoals.id));
    return this.hydrate(rows);
  }

  /** Goals this report is reviewing — i.e. last quarter's goals. */
  async listReviewedIn(reportId: ID) {
    const rows = await this.selectWithSensitivity(
      and(
        eq(gtlReportGoals.reviewedInReportId, reportId),
        isNull(gtlReportGoals.deletedAt),
      ),
    ).orderBy(asc(gtlReportGoals.order), asc(gtlReportGoals.id));
    return this.hydrate(rows);
  }

  async create(input: CreateGtlReportGoal) {
    const id = await generateId<ID<'GtlReportGoal'>>();
    await this.db.insert(gtlReportGoals).values({
      id,
      setInReportId: input.report as ID<'GTLReport'>,
      goal: input.goal,
      details: input.details ?? null,
      order: input.order ?? 0,
    });
    return await this.readOne(id);
  }

  async update(input: UpdateGtlReportGoal) {
    await this.updateColumns(input.id, {
      ...(input.goal !== undefined && { goal: input.goal }),
      ...(input.details !== undefined && { details: input.details }),
      ...(input.order !== undefined && { order: input.order }),
      modifiedAt: new Date(),
    });
    return await this.readOne(input.id);
  }

  async review(input: ReviewGtlReportGoal) {
    await this.updateColumns(input.id, {
      reviewedInReportId: input.reviewedInReport as ID<'GTLReport'>,
      met: input.met,
      impact: input.impact ?? null,
      modifiedAt: new Date(),
    });
    return await this.readOne(input.id);
  }

  async delete(id: ID) {
    await this.softDelete(id);
  }
}
