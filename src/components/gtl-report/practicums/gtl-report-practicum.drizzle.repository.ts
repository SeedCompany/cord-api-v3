import { Injectable } from '@nestjs/common';
import { and, asc, eq, inArray, isNull, type SQL } from 'drizzle-orm';
import { DateTime } from 'luxon';
import { generateId, type ID, type UnsecuredDto } from '~/common';
import { DrizzleDtoRepository, DrizzleService } from '~/core/drizzle';
import {
  engagements,
  gtlReportPracticums,
  periodicReports,
  projects,
} from '~/core/drizzle/schema';
import {
  type CreateGtlReportPracticum,
  GtlReportPracticum,
  type UpdateGtlReportPracticum,
} from '../dto';

type Row = typeof gtlReportPracticums.$inferSelect & { sensitivity?: string };

@Injectable()
export class GtlReportPracticumDrizzleRepository extends DrizzleDtoRepository<
  typeof gtlReportPracticums,
  GtlReportPracticum
> {
  constructor(db: DrizzleService) {
    super(db, gtlReportPracticums, GtlReportPracticum);
  }

  protected toDto(row: Row): UnsecuredDto<GtlReportPracticum> {
    const dto: unknown = {
      id: row.id,
      report: { id: row.reportId },
      involvement: row.involvement,
      mentor: row.mentorId ? { id: row.mentorId } : null,
      outcomes: row.outcomes,
      order: row.order,
      sensitivity: row.sensitivity ?? 'High',
      createdAt: DateTime.fromJSDate(row.createdAt),
      modifiedAt: DateTime.fromJSDate(row.modifiedAt),
    };
    return dto as UnsecuredDto<GtlReportPracticum>;
  }

  private selectWithSensitivity(predicate: SQL | undefined) {
    return this.db
      .select({
        practicum: gtlReportPracticums,
        sensitivity: projects.sensitivity,
      })
      .from(gtlReportPracticums)
      .innerJoin(
        periodicReports,
        and(
          eq(periodicReports.id, gtlReportPracticums.reportId),
          isNull(periodicReports.deletedAt),
        ),
      )
      .innerJoin(engagements, eq(engagements.id, periodicReports.engagementId))
      .innerJoin(projects, eq(projects.id, engagements.projectId))
      .where(predicate);
  }

  private hydrate(
    rows: Array<{
      practicum: typeof gtlReportPracticums.$inferSelect;
      sensitivity: string;
    }>,
  ) {
    return rows.map((r) =>
      this.toDto({ ...r.practicum, sensitivity: r.sensitivity }),
    );
  }

  override async readMany(ids: readonly ID[]) {
    const rows = await this.selectWithSensitivity(
      and(
        inArray(gtlReportPracticums.id, [...ids]),
        isNull(gtlReportPracticums.deletedAt),
      ),
    );
    return this.hydrate(rows);
  }

  async listForReport(reportId: ID) {
    const rows = await this.selectWithSensitivity(
      and(
        eq(gtlReportPracticums.reportId, reportId),
        isNull(gtlReportPracticums.deletedAt),
      ),
    ).orderBy(asc(gtlReportPracticums.order), asc(gtlReportPracticums.id));
    return this.hydrate(rows);
  }

  async create(input: CreateGtlReportPracticum) {
    const id = await generateId<ID<'GtlReportPracticum'>>();
    await this.db.insert(gtlReportPracticums).values({
      id,
      reportId: input.report as ID<'GTLReport'>,
      involvement: input.involvement,
      mentorId: (input.mentor ?? null) as ID<'User'> | null,
      outcomes: input.outcomes ?? null,
      order: input.order ?? 0,
    });
    return await this.readOne(id);
  }

  async update(input: UpdateGtlReportPracticum) {
    await this.updateColumns(input.id, {
      ...(input.involvement !== undefined && {
        involvement: input.involvement,
      }),
      ...(input.mentor !== undefined && {
        mentorId: (input.mentor ?? null) as ID<'User'> | null,
      }),
      ...(input.outcomes !== undefined && { outcomes: input.outcomes }),
      ...(input.order !== undefined && { order: input.order }),
      modifiedAt: new Date(),
    });
    return await this.readOne(input.id);
  }

  async delete(id: ID) {
    await this.softDelete(id);
  }
}
