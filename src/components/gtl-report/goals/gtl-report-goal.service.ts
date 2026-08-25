import { Injectable } from '@nestjs/common';
import { type ID, type UnsecuredDto } from '~/common';
import { Privileges } from '../../authorization';
import {
  type CreateGtlReportGoal,
  GtlReportGoal,
  type ReviewGtlReportGoal,
  type UpdateGtlReportGoal,
} from '../dto';
import { GtlReportGoalDrizzleRepository } from './gtl-report-goal.drizzle.repository';

@Injectable()
export class GtlReportGoalService {
  constructor(
    private readonly repo: GtlReportGoalDrizzleRepository,
    private readonly privileges: Privileges,
  ) {}

  secure(dto: UnsecuredDto<GtlReportGoal>): GtlReportGoal {
    return this.privileges.for(GtlReportGoal, dto).secure(dto);
  }

  async readOne(id: ID) {
    return this.secure(await this.repo.readOne(id));
  }

  async readMany(ids: readonly ID[]) {
    return (await this.repo.readMany(ids)).map((dto) => this.secure(dto));
  }

  async listSetIn(reportId: ID) {
    return (await this.repo.listSetIn(reportId)).map((dto) => this.secure(dto));
  }

  async listReviewedIn(reportId: ID) {
    return (await this.repo.listReviewedIn(reportId)).map((dto) =>
      this.secure(dto),
    );
  }

  async create(input: CreateGtlReportGoal) {
    this.privileges.for(GtlReportGoal).verifyCan('create');
    return this.secure(await this.repo.create(input));
  }

  async update(input: UpdateGtlReportGoal) {
    const existing = await this.repo.readOne(input.id);
    this.privileges.for(GtlReportGoal, existing).verifyCan('edit');
    return this.secure(await this.repo.update(input));
  }

  /**
   * Authorised against the REVIEWING report, not the goal's parent — see
   * `ReviewGtlReportGoal`'s doc comment.
   */
  async review(input: ReviewGtlReportGoal) {
    const existing = await this.repo.readOne(input.id);
    this.privileges.for(GtlReportGoal, existing).verifyCan('edit');
    return this.secure(await this.repo.review(input));
  }

  async delete(id: ID) {
    const existing = await this.repo.readOne(id);
    this.privileges.for(GtlReportGoal, existing).verifyCan('delete');
    await this.repo.delete(id);
  }
}
