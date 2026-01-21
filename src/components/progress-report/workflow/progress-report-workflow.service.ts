import { Injectable } from '@nestjs/common';
import {
  type ID,
  many,
  type RichTextDocument,
  UnauthorizedException,
  type UnsecuredDto,
} from '~/common';
import { IEventBus } from '~/core';
import { Privileges } from '../../authorization';
import {
  type ProgressReport,
  type ProgressReportStatus as Status,
} from '../dto';
import { type ExecuteProgressReportTransition } from './dto/execute-progress-report-transition.input';
import { ProgressReportWorkflowEvent as WorkflowEvent } from './dto/workflow-event.dto';
import { WorkflowUpdatedEvent } from './events/workflow-updated.event';
import { ProgressReportWorkflowRepository } from './progress-report-workflow.repository';
import { type InternalTransition, Transitions } from './transitions';

@Injectable()
export class ProgressReportWorkflowService {
  constructor(
    private readonly privileges: Privileges,
    private readonly repo: ProgressReportWorkflowRepository,
    private readonly eventBus: IEventBus,
  ) {}

  async list(report: ProgressReport): Promise<WorkflowEvent[]> {
    const dtos = await this.repo.list(report.id);
    return dtos.map((dto) => this.secure(dto));
  }

  async readMany(ids: readonly ID[]) {
    const dtos = await this.repo.readMany(ids);
    return dtos.map((dto) => this.secure(dto));
  }

  secure(dto: UnsecuredDto<WorkflowEvent>): WorkflowEvent {
    const secured = this.privileges.for(WorkflowEvent).secure(dto);
    return {
      ...secured,
      transition: dto.transition
        ? Object.values(Transitions).find((t) => t.id === dto.transition)
        : undefined,
    };
  }

  getAvailableTransitions(current: Status) {
    const p = this.privileges.for(WorkflowEvent);
    const available = Object.values(Transitions).filter(
      (t) =>
        (t.from ? many(t.from).includes(current) : true) &&
        // I don't have a good way to type this right now.
        // Context usage is still fuzzy when conditions need different shapes.
        p.forContext({ transition: t.id } as any).can('create'),
    );
    return available;
  }

  canBypass() {
    return this.privileges.for(WorkflowEvent).can('create');
  }

  async executeTransition(input: ExecuteProgressReportTransition) {
    const { report: reportId, notes } = input;

    const currentStatus = await this.repo.currentStatus(reportId);
    const next = this.validateExecutionInput(input, currentStatus);
    const isTransition = typeof next !== 'string';

    const [unsecuredEvent] = await Promise.all([
      isTransition
        ? this.recordTransition(reportId, next, notes)
        : this.recordBypass(reportId, next, notes),
      this.repo.changeStatus(reportId, isTransition ? next.to : next),
    ]);

    const event = new WorkflowUpdatedEvent(
      reportId,
      currentStatus,
      next,
      unsecuredEvent,
    );
    await this.eventBus.publish(event);
  }

  private validateExecutionInput(
    input: ExecuteProgressReportTransition,
    currentStatus: Status,
  ) {
    const { transition: transitionId, status: overrideStatus } = input;

    if (overrideStatus) {
      if (!this.canBypass()) {
        throw new UnauthorizedException(
          'You do not have permission to bypass workflow. Specify a transition ID instead.',
        );
      }
      return overrideStatus;
    }

    const available = this.getAvailableTransitions(currentStatus);
    const transition = available.find((t) => t.id === transitionId);
    if (!transition) {
      throw new UnauthorizedException('This transition is not available');
    }
    return transition;
  }

  async recordTransition(
    report: ID,
    { id: transition, to: status }: InternalTransition,
    notes?: RichTextDocument,
  ) {
    return await this.repo.recordEvent({ report, status, transition, notes });
  }

  async recordBypass(report: ID, status: Status, notes?: RichTextDocument) {
    return await this.repo.recordEvent({ report, status, notes });
  }
}
