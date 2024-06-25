import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Session, UnsecuredDto } from '~/common';
import { IEventBus, ResourceLoader } from '~/core';
import {
  findTransition,
  WorkflowService,
} from '../../workflow/workflow.service';
import { Engagement, EngagementStatus } from '../dto';
import {
  ExecuteEngagementTransitionInput,
  EngagementWorkflowEvent as WorkflowEvent,
} from './dto';
import { EngagementWorkflow } from './engagement-workflow';
import { EngagementWorkflowRepository } from './engagement-workflow.repository';
//import { EngagementTransitionedEvent } from './events/engagement-transitioned.event';

@Injectable()
export class EngagementWorkflowService extends WorkflowService(
  () => EngagementWorkflow,
) {
  constructor(
    private readonly resources: ResourceLoader,
    private readonly repo: EngagementWorkflowRepository,
    private readonly eventBus: IEventBus,
    private readonly moduleRef: ModuleRef,
  ) {
    super();
  }

  // async list(report: Project, session: Session): Promise<WorkflowEvent[]> {
  //   const dtos = await this.repo.list(report.id, session);
  //   return dtos.map((dto) => this.secure(dto, session));
  // }

  // async readMany(ids: readonly ID[], session: Session) {
  //   const dtos = await this.repo.readMany(ids, session);
  //   return dtos.map((dto) => this.secure(dto, session));
  // }

  private secure(
    dto: UnsecuredDto<WorkflowEvent>,
    session: Session,
  ): WorkflowEvent {
    return {
      ...this.privileges.for(session, WorkflowEvent).secure(dto),
      transition: this.transitionByKey(dto.transition, dto.to),
    };
  }

  async getAvailableTransitions(engagement: Engagement, session: Session) {
    return await this.resolveAvailable(
      engagement.status.value!,
      { engagement, moduleRef: this.moduleRef },
      { ...engagement, engagement },
      session,
    );
  }

  async canBypassWorkflow(session: Session) {
    return this.canBypass(session);
  }

  canBypass(session: Session) {
    return this.privileges.for(session, WorkflowEvent).can('create');
  }

  async executeTransition(
    input: ExecuteEngagementTransitionInput,
    session: Session,
  ) {
    const { engagement: engagementId, notes } = input;

    const { EngagementLoader } = await import('../engagement.loader');
    const engagements = await this.resources.getLoader(EngagementLoader);
    const loaderKey = {
      id: engagementId,
      view: { active: true },
    } as const;
    const previous = await engagements.load(loaderKey);

    const next =
      this.getBypassIfValid(input, session) ??
      findTransition(
        await this.getAvailableTransitions(previous, session),
        input.transition,
      );

    const unsecuredEvent = await this.repo.recordEvent(
      {
        engagement: engagementId,
        ...(typeof next !== 'string'
          ? { transition: next.key, to: next.to }
          : { to: next }),
        notes,
      },
      session,
    );

    engagements.clear(loaderKey);
    const updated = await engagements.load(loaderKey);

    // const event = new EngagementTransitionedEvent(
    //   updated,
    //   previous.status.value!,
    //   next,
    //   unsecuredEvent,
    // );
    // await this.eventBus.publish(event);

    return updated;
  }

  /** @deprecated */
  async executeTransitionLegacy(
    currentEngagement: Engagement,
    step: EngagementStatus,
    session: Session,
  ) {
    const transitions = await this.getAvailableTransitions(
      currentEngagement,
      session,
    );
    // Pick the first matching to step.
    // Lack of detail is one of the reasons why this is legacy logic.
    const transition = transitions.find((t) => t.to === step);

    await this.executeTransition(
      {
        engagement: currentEngagement.id,
        ...(transition ? { transition: transition.key } : { bypassTo: step }),
      },
      session,
    );
  }
}
