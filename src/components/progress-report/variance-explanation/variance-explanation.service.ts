import { Injectable } from '@nestjs/common';
import { mapKeys } from '@seedcompany/common';
import { InputException, NotFoundException, Session } from '~/common';
import { ResourceLoader } from '~/core';
import { Privileges } from '../../authorization';
import { ProgressReport } from '../dto';
import { ProgressReportVarianceExplanationReasonOptions as ReasonOptions } from './reason-options';
import {
  ProgressReportVarianceExplanation as VarianceExplanation,
  ProgressReportVarianceExplanationInput as VarianceExplanationInput,
} from './variance-explanation.dto';
import { ProgressReportVarianceExplanationRepository } from './variance-explanation.repository';

@Injectable()
export class ProgressReportVarianceExplanationService {
  constructor(
    private readonly privileges: Privileges,
    private readonly resources: ResourceLoader,
    private readonly repo: ProgressReportVarianceExplanationRepository,
  ) {}

  async readMany(reports: readonly ProgressReport[], session: Session) {
    const reportMap = mapKeys.fromList(reports, (r) => r.id).asRecord;
    const dtos = await this.repo.readMany(reports);
    return dtos.map((dto) => {
      const report = reportMap[dto.report];
      const secured = this.privilegesFor(session, report).secure(dto);
      return { ...secured, report };
    });
  }

  async update(
    input: VarianceExplanationInput,
    session: Session,
  ): Promise<ProgressReport> {
    const report = await this.resources.load(ProgressReport, input.report);
    const [existing] = await this.readMany([report], session);
    if (!existing) {
      throw new NotFoundException();
    }

    const changes = this.repo.getActualChanges(existing, {
      reasons:
        input.reasons === undefined
          ? existing.reasons.value
          : input.reasons === null
          ? []
          : input.reasons,
      comments: input.comments,
    });
    if (Object.keys(changes).length === 0) {
      return report;
    }

    // Don't allow changing to a deprecated reason.
    // Here to be nice and allow updating the comments even if the current
    // reason is deprecated.
    if (
      changes.reasons?.some((r) => ReasonOptions.instance.deprecated.has(r))
    ) {
      throw new InputException(
        'Reason is deprecated and cannot be used',
        'reasons',
      );
    }

    this.privilegesFor(session, report).verifyChanges(changes);

    await this.repo.update(report.id, changes, session);

    return report;
  }

  private privilegesFor(session: Session, report: ProgressReport) {
    const context = report as any; // the report is fine to give context
    return this.privileges.for(session, VarianceExplanation, context);
  }
}
