import { Injectable } from '@nestjs/common';
import {
  type ID,
  InputException,
  NotFoundException,
  type Sensitivity,
  type UnsecuredDto,
} from '~/common';
import { Privileges } from '../../authorization';
import { type ScopedRole } from '../../authorization/dto/role.dto';
import {
  type CreateGtlGoal,
  GtlGoal,
  type GtlGoalMeasurement,
  GtlGoalProgress,
  type GtlGoalProgressReported,
  type GtlGoalStatus,
  type GtlGoalSummary,
  type ReportGtlGoalProgress,
  type UpdateGtlGoal,
} from '../dto';
import { GtlGoalRepository } from './gtl-goal.repository';

/**
 * A parent's membership and sensitivity, standing in as the privilege context
 * for a child that does not exist yet. The member and sensitivity conditions
 * read exactly these two properties off whatever object they are given.
 */
const contextOf = <T extends GtlGoal | GtlGoalProgress>(parent: {
  scope: readonly ScopedRole[];
  sensitivity: Sensitivity;
}): UnsecuredDto<T> => {
  const context: unknown = {
    scope: parent.scope,
    sensitivity: parent.sensitivity,
  };
  return context as UnsecuredDto<T>;
};

@Injectable()
export class GtlGoalService {
  constructor(
    private readonly repo: GtlGoalRepository,
    private readonly privileges: Privileges,
  ) {}

  secure(dto: UnsecuredDto<GtlGoal>): GtlGoal {
    // The DTO carries its own `scope` and `sensitivity`, so it is its own
    // privilege context.
    return this.privileges.for(GtlGoal).secure(dto);
  }

  secureProgress(dto: UnsecuredDto<GtlGoalProgress>): GtlGoalProgress {
    return this.privileges.for(GtlGoalProgress).secure(dto);
  }

  async readOne(id: ID): Promise<GtlGoal> {
    return this.secure(await this.repo.readOne(id));
  }

  async readMany(ids: readonly ID[]): Promise<GtlGoal[]> {
    const dtos = await this.repo.readMany(ids);
    return dtos.map((dto) => this.secure(dto));
  }

  async listSetInReport(reportId: ID): Promise<GtlGoal[]> {
    const dtos = await this.repo.listSetInReport(reportId);
    return dtos.map((dto) => this.secure(dto));
  }

  /**
   * The whole plan plus its rollup, for the engagement's Goals tab. Counted
   * from the unsecured rows — the read policy has already decided, in SQL,
   * which goals this requester may see at all.
   */
  async summaryForEngagement(engagementId: ID): Promise<GtlGoalSummary> {
    const goals = await this.repo.listForEngagement(engagementId);
    const countWith = (...statuses: GtlGoalStatus[]) =>
      goals.filter((goal) => statuses.includes(goal.status)).length;
    return {
      goals: goals.map((goal) => this.secure(goal)),
      total: goals.length,
      done: countWith('Done'),
      active: countWith('Planned', 'InProgress'),
      needsAttention: countWith('AtRisk', 'OnHold'),
      behindSchedule: goals.filter((goal) => goal.scheduleStatus === 'Behind')
        .length,
      percentComplete:
        goals.length === 0
          ? 0
          : Math.round(
              goals.reduce((sum, goal) => sum + goal.percentComplete, 0) /
                goals.length,
            ),
    };
  }

  async create(input: CreateGtlGoal): Promise<GtlGoal> {
    // Loaded unfiltered, so a non-member is answered with the permission error
    // below rather than "not found".
    const engagement = await this.repo.readEngagementContext(input.engagement);
    if (!engagement) {
      throw new NotFoundException('Could not find engagement', 'engagement');
    }
    if (engagement.type !== 'Internship') {
      throw new InputException(
        'Goals belong to Internship (GTL) engagements',
        'engagement',
      );
    }
    this.privileges
      .for(GtlGoal, contextOf<GtlGoal>(engagement))
      .verifyCan('create');

    const shape = this.verifyMeasurementShape(input);
    if (input.setInReport) {
      await this.verifyReportOnEngagement(
        input.setInReport,
        engagement.id,
        'setInReport',
      );
    }
    const goal = await this.repo.create({ ...input, ...shape });
    return this.secure(goal);
  }

  async update(input: UpdateGtlGoal): Promise<GtlGoal> {
    const existing = await this.repo.readOne(input.id);
    this.privileges.for(GtlGoal, existing).verifyCan('edit');
    // Checked against what the row will look like after the change, so a
    // measurement switch has to come with a matching target (or none).
    const shape = this.verifyMeasurementShape({
      measurement: input.measurement ?? existing.measurement,
      targetNumber:
        input.targetNumber !== undefined
          ? input.targetNumber
          : existing.targetNumber,
      targetDescription:
        input.targetDescription !== undefined
          ? input.targetDescription
          : existing.targetDescription,
    });
    const updated = await this.repo.update(
      { ...input, ...shape },
      existing.engagement.id,
    );
    return this.secure(updated);
  }

  async delete(id: ID): Promise<void> {
    const existing = await this.repo.readOne(id);
    this.privileges.for(GtlGoal, existing).verifyCan('delete');
    await this.repo.delete(id, existing.engagement.id);
  }

  async reportProgress(
    input: ReportGtlGoalProgress,
  ): Promise<GtlGoalProgressReported> {
    const goal = await this.repo.readOne(input.goal);
    const report = await this.verifyReportOnEngagement(
      input.report,
      goal.engagement.id,
      'report',
    );

    // Revising this quarter's entry is an edit of it; a first entry is a
    // create under the report.
    const existing = await this.repo.findProgress(goal.id, report.id);
    this.privileges
      .for(GtlGoalProgress, existing ?? contextOf<GtlGoalProgress>(report))
      .verifyCan(existing ? 'edit' : 'create');

    // Defaults to the period being reported on, not to today — a report filed
    // late still describes its own quarter.
    const progressDate = input.progressDate?.toISODate() ?? report.end;

    const id = await this.repo.reportProgress(
      input,
      progressDate,
      goal.engagement.id,
    );
    return {
      progress: this.secureProgress(await this.repo.readProgress(id)),
      gtlGoal: this.secure(await this.repo.readOne(goal.id)),
    };
  }

  async listProgressForReport(reportId: ID): Promise<GtlGoalProgress[]> {
    const dtos = await this.repo.listProgressForReport(reportId);
    return dtos.map((dto) => this.secureProgress(dto));
  }

  /**
   * The report has to be a live GTL report on the goal's own engagement — a
   * quarter of some other leader's program can't say anything about this goal.
   */
  private async verifyReportOnEngagement(
    reportId: ID,
    engagementId: ID,
    field: 'report' | 'setInReport',
  ) {
    const report = await this.repo.readReportContext(reportId);
    if (!report) {
      throw new InputException(
        'Could not find a GTL report with that id',
        field,
      );
    }
    if (report.engagementId !== engagementId) {
      throw new InputException(
        'The report is not on the same engagement as the goal',
        field,
      );
    }
    return report;
  }

  /**
   * A counted goal needs something to count toward — a target number and what
   * it counts — while the other measurements derive their target and must not
   * carry a number. The DB enforces this too (migration 0005); the check here
   * exists to fail with a field-attributed message instead of a constraint
   * violation, and to normalize the row: a goal that is not counted keeps no
   * description either.
   */
  private verifyMeasurementShape(input: {
    measurement?: GtlGoalMeasurement | null;
    targetNumber?: number | null;
    targetDescription?: string | null;
  }): {
    measurement: GtlGoalMeasurement;
    targetNumber: number | null;
    targetDescription: string | null;
  } {
    const measurement = input.measurement ?? 'Boolean';
    if (measurement === 'Number') {
      if (!input.targetNumber || input.targetNumber <= 0) {
        throw new InputException(
          'A goal counted toward a target needs a target number',
          'targetNumber',
        );
      }
      const targetDescription = input.targetDescription?.trim();
      if (!targetDescription) {
        throw new InputException(
          'A goal counted toward a target needs to say what is being counted',
          'targetDescription',
        );
      }
      return {
        measurement,
        targetNumber: input.targetNumber,
        targetDescription,
      };
    }
    if (input.targetNumber != null) {
      throw new InputException(
        'Only goals measured by Number carry a target number',
        'targetNumber',
      );
    }
    return { measurement, targetNumber: null, targetDescription: null };
  }
}
