import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { ID, Session, UnsecuredDto } from '~/common';
import { IEventBus } from '~/core';
import {
  findTransition,
  WorkflowService,
} from '../../workflow/workflow.service';
import { Engagement, EngagementStatus } from '../dto';
import { EngagementService } from '../engagement.service';
import { EngagementUpdatedEvent } from '../events';
import {
  ExecuteEngagementTransitionInput,
  EngagementWorkflowEvent as WorkflowEvent,
} from './dto';
import { EngagementWorkflow } from './engagement-workflow';
import { EngagementWorkflowRepository } from './engagement-workflow.repository';

@Injectable()
export class EngagementWorkflowService extends WorkflowService(
  () => EngagementWorkflow,
) {
  constructor(
    @Inject(forwardRef(() => EngagementService))
    private readonly engagements: EngagementService & {},
    private readonly repo: EngagementWorkflowRepository,
    private readonly moduleRef: ModuleRef,
    private readonly eventBus: IEventBus,
  ) {
    super();
  }

  async list(
    engagement: Engagement,
    session: Session,
  ): Promise<WorkflowEvent[]> {
    const dtos = await this.repo.list(engagement.id, session);
    return dtos.map((dto) => this.secure(dto, session));
  }

  async readMany(ids: readonly ID[], session: Session) {
    const dtos = await this.repo.readMany(ids, session);
    return dtos.map((dto) => this.secure(dto, session));
  }

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

  async executeTransition(
    input: ExecuteEngagementTransitionInput,
    session: Session,
    // eslint-disable-next-line @typescript-eslint/no-inferrable-types
    isLegacy: boolean = false,
  ) {
    const { engagement: engagementId, notes } = input;

    const previous = await this.engagements.readOneUnsecured(
      engagementId,
      session,
    );
    const object = await this.engagements.secure(previous, session);
    //const previous = await this.engagements.readOne(engagementId, session);

    const next =
      this.getBypassIfValid(input, session) ??
      findTransition(
        await this.getAvailableTransitions(object, session),
        input.transition,
      );

    await this.repo.recordEvent(
      {
        engagement: engagementId,
        ...(typeof next !== 'string'
          ? { transition: next.key, to: next.to }
          : { to: next }),
        notes,
      },
      session,
    );

    const updated = await this.engagements.readOneUnsecured(
      engagementId,
      session,
    );
    if (!isLegacy) {
      const event = new EngagementUpdatedEvent(updated, previous, session);
      await this.eventBus.publish(event);
      return await this.engagements.secure(event.updated, session);
    }
    return await this.engagements.secure(updated, session);
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

    const transition = transitions.find((t) => t.to === step);
    await this.executeTransition(
      {
        engagement: currentEngagement.id,
        ...(transition ? { transition: transition.key } : { bypassTo: step }),
      },
      session,
      true,
    );
  }
}
