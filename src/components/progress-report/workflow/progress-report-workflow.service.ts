import { Injectable } from '@nestjs/common';
import {
  ID,
  many,
  Session,
  UnauthorizedException,
  UnsecuredDto,
} from '~/common';
import { ResourceLoader } from '~/core';
import { Privileges } from '../../authorization';
import { ProgressReport, ProgressReportStatus as Status } from '../dto';
import { ExecuteProgressReportTransitionInput } from './dto/execute-progress-report-transition.input';
import { ProgressReportWorkflowEvent as WorkflowEvent } from './dto/workflow-event.dto';
import { ProgressReportWorkflowRepository } from './progress-report-workflow.repository';
import { Transitions } from './transitions';

@Injectable()
export class ProgressReportWorkflowService {
  constructor(
    private readonly privileges: Privileges,
    private readonly resources: ResourceLoader,
    private readonly repo: ProgressReportWorkflowRepository
  ) {}

  async list(
    report: ProgressReport,
    session: Session
  ): Promise<WorkflowEvent[]> {
    const dtos = await this.repo.list(report.id, session);
    return dtos.map((dto) => this.secure(dto, session));
  }

  async readMany(ids: readonly ID[], session: Session) {
    const dtos = await this.repo.readMany(ids, session);
    return dtos.map((dto) => this.secure(dto, session));
  }

  private secure(
    dto: UnsecuredDto<WorkflowEvent>,
    session: Session
  ): WorkflowEvent {
    const secured = this.privileges.for(session, WorkflowEvent).secure(dto);
    return {
      ...secured,
      transition: dto.transition
        ? Object.values(Transitions).find((t) => t.id === dto.transition)
        : undefined,
    };
  }

  getAvailableTransitions(session: Session, current: Status) {
    const p = this.privileges.for(session, WorkflowEvent);
    const available = Object.values(Transitions).filter(
      (t) =>
        (t.from ? many(t.from).includes(current) : true) &&
        // I don't have a good way to type this right now.
        // Context usage is still fuzzy when conditions need different shapes.
        p.forContext({ transition: t.id } as any).can('create')
    );
    return available;
  }

  canBypass(session: Session) {
    return this.privileges.for(session, WorkflowEvent).can('create');
  }

  async executeTransition(
    {
      reportId,
      transitionId,
      status: overrideStatus,
    }: ExecuteProgressReportTransitionInput,
    session: Session
  ) {
    const currentStatus = await this.repo.currentStatus(reportId);

    if (overrideStatus) {
      if (!this.canBypass(session)) {
        throw new UnauthorizedException(
          'You do not have permission to bypass workflow. Specify a transition ID instead.'
        );
      }

      await Promise.all([
        this.repo.recordBypass(reportId, overrideStatus, session),
        this.repo.changeStatus(reportId, overrideStatus),
      ]);
      return;
    }

    const available = this.getAvailableTransitions(session, currentStatus);
    const transition = available.find((t) => t.id === transitionId);
    if (!transition) {
      throw new UnauthorizedException('This transition is not available');
    }

    await Promise.all([
      this.repo.recordTransition(reportId, transition, session),
      this.repo.changeStatus(reportId, transition.to),
    ]);

    // TODO(transition.notify);
  }
}
