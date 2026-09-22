import { Injectable } from '@nestjs/common';
import {
  CalendarDate,
  type ID,
  InputException,
  type UnsecuredDto,
} from '~/common';
import { Privileges } from '../../authorization';
import { PeriodicReportService } from '../../periodic-report';
import {
  type CreateGtlGoal,
  GtlGoal,
  type GtlGoalProgress,
  type GtlGoalSummary,
  type ReportGtlGoalProgress,
  type UpdateGtlGoal,
} from '../dto';
import { GtlGoalDrizzleRepository } from './gtl-goal.drizzle.repository';

@Injectable()
export class GtlGoalService {
  constructor(
    private readonly repo: GtlGoalDrizzleRepository,
    private readonly reports: PeriodicReportService,
    private readonly privileges: Privileges,
  ) {}

  secure(dto: UnsecuredDto<GtlGoal>): GtlGoal {
    return this.privileges.for(GtlGoal, dto).secure(dto);
  }

  async readOne(id: ID) {
    return this.secure(await this.repo.readOne(id));
  }

  async readMany(ids: readonly ID[]) {
    return (await this.repo.readMany(ids)).map((dto) => this.secure(dto));
  }

  async listForEngagement(engagementId: ID) {
    return (await this.repo.listForEngagement(engagementId)).map((dto) =>
      this.secure(dto),
    );
  }

  async listSetInReport(reportId: ID) {
    return (await this.repo.listSetInReport(reportId)).map((dto) =>
      this.secure(dto),
    );
  }

  /** The whole plan plus its rollup, for the engagement's Goals tab. */
  async summaryForEngagement(engagementId: ID): Promise<GtlGoalSummary> {
    const goals = await this.listForEngagement(engagementId);
    const by = (...statuses: string[]) =>
      goals.filter((g) => statuses.includes(g.status.value ?? '')).length;
    return {
      goals,
      total: goals.length,
      done: by('Done'),
      active: by('Planned', 'InProgress'),
      needsAttention: by('AtRisk', 'OnHold'),
      behindSchedule: goals.filter((g) => g.scheduleStatus === 'Behind').length,
      percentComplete:
        goals.length === 0
          ? 0
          : Math.round(
              goals.reduce((sum, g) => sum + g.percentComplete, 0) /
                goals.length,
            ),
    };
  }

  async create(input: CreateGtlGoal) {
    this.privileges.for(GtlGoal).verifyCan('create');
    this.verifyMeasurementShape(input);
    return this.secure(await this.repo.create(input));
  }

  async update(input: UpdateGtlGoal) {
    const existing = await this.repo.readOne(input.id);
    this.privileges.for(GtlGoal, existing).verifyCan('edit');
    this.verifyMeasurementShape({
      measurement: input.measurement ?? existing.measurement,
      targetNumber:
        input.targetNumber !== undefined
          ? input.targetNumber
          : existing.targetNumber,
    });
    return this.secure(await this.repo.update(input));
  }

  async delete(id: ID) {
    const existing = await this.repo.readOne(id);
    this.privileges.for(GtlGoal, existing).verifyCan('delete');
    await this.repo.delete(id);
  }

  async reportProgress(input: ReportGtlGoalProgress) {
    const goal = await this.repo.readOne(input.goal);
    this.privileges.for(GtlGoal, goal).verifyCan('edit');

    // Defaults to the period being reported on, not to today — a report filed
    // late still describes its own quarter.
    const report = await this.reports.readOne(input.report);
    const progressDate = (input.progressDate ?? report.end).toISODate();

    const id = await this.repo.reportProgress(input, progressDate);
    return {
      progress: await this.readProgress(id),
      gtlGoal: this.secure(await this.repo.readOne(input.goal)),
    };
  }

  async readProgress(id: ID): Promise<GtlGoalProgress> {
    const row = await this.repo.readProgress(id);
    if (!row) {
      throw new InputException('Progress entry not found', 'id');
    }
    return this.toProgressDto(row);
  }

  async listProgressForReport(reportId: ID) {
    const rows = await this.repo.listProgressForReport(reportId);
    return rows.map((row) => this.toProgressDto(row));
  }

  private toProgressDto(row: {
    id: ID<'GtlGoalProgress'>;
    goalId: ID<'GtlGoal'>;
    reportId: ID<'GTLReport'>;
    status: string;
    progressValue: number | null;
    notes: unknown;
    progressDate: string;
    createdAt: Date;
  }): GtlGoalProgress {
    const yes = { canRead: true, canEdit: true };
    const dto: unknown = {
      id: row.id,
      goal: { id: row.goalId },
      report: { id: row.reportId },
      status: { ...yes, value: row.status },
      progressValue: { ...yes, value: row.progressValue },
      notes: { ...yes, value: row.notes ?? null },
      progressDate: { ...yes, value: CalendarDate.fromISO(row.progressDate) },
      sensitivity: 'High',
      createdAt: row.createdAt,
      canDelete: true,
    };
    return dto as GtlGoalProgress;
  }

  /**
   * A counted goal needs something to count toward; the other measurements
   * derive their target and must not carry one. The DB enforces this too — the
   * check here exists to fail with a field-attributed message instead of a
   * constraint violation.
   */
  private verifyMeasurementShape(input: {
    measurement?: string | null;
    targetNumber?: number | null;
  }) {
    const measurement = input.measurement ?? 'Boolean';
    if (measurement === 'Number' && !input.targetNumber) {
      throw new InputException(
        'A goal counted toward a target needs a target number',
        'targetNumber',
      );
    }
    if (measurement !== 'Number' && input.targetNumber != null) {
      throw new InputException(
        'Only goals measured by Number carry a target number',
        'targetNumber',
      );
    }
  }
}
