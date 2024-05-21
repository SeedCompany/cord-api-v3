import { Injectable } from '@nestjs/common';
import {
  ID,
  many,
  Session,
  UnauthorizedException,
  UnsecuredDto,
} from '~/common';
import { IEventBus, ResourceLoader } from '~/core';
import { Privileges } from '../../authorization';
import { Project } from '../dto';
import { ProjectLoader } from '../project.loader';
import {
  ExecuteProjectTransitionInput,
  ProjectWorkflowEvent as WorkflowEvent,
} from './dto';
import { ProjectTransitionedEvent } from './events/project-transitioned.event';
import { ProjectWorkflowRepository } from './project-workflow.repository';
import { Transitions } from './transitions';

@Injectable()
export class ProjectWorkflowService {
  constructor(
    private readonly privileges: Privileges,
    private readonly resources: ResourceLoader,
    private readonly repo: ProjectWorkflowRepository,
    private readonly eventBus: IEventBus,
  ) {}

  async list(report: Project, session: Session): Promise<WorkflowEvent[]> {
    const dtos = await this.repo.list(report.id, session);
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
    const secured = this.privileges.for(session, WorkflowEvent).secure(dto);
    return {
      ...secured,
      transition: dto.transition
        ? Object.values(Transitions).find((t) => t.id === dto.transition) ??
          null
        : null,
    };
  }

  getAvailableTransitions(project: Project, session: Session) {
    const p = this.privileges.for(session, WorkflowEvent);
    const available = Object.values(Transitions).filter(
      (t) =>
        (t.from ? many(t.from).includes(project.step.value!) : true) &&
        // I don't have a good way to type this right now.
        // Context usage is still fuzzy when conditions need different shapes.
        p.forContext({ transition: t.id } as any).can('create'),
    );
    return available;
  }

  canBypass(session: Session) {
    return this.privileges.for(session, WorkflowEvent).can('create');
  }

  async executeTransition(
    input: ExecuteProjectTransitionInput,
    session: Session,
  ) {
    const { project: projectId, notes } = input;

    const projects = await this.resources.getLoader(ProjectLoader);
    const loaderKey = {
      id: projectId,
      view: { active: true },
    } as const;
    const previous = await projects.load(loaderKey);

    const next = this.validateExecutionInput(input, previous, session);

    const unsecuredEvent = await this.repo.recordEvent(
      {
        project: projectId,
        ...(typeof next !== 'string'
          ? { transition: next.id, step: next.to }
          : { step: next }),
        notes,
      },
      session,
    );

    projects.clear(loaderKey);
    const updated = await projects.load(loaderKey);

    const event = new ProjectTransitionedEvent(
      updated,
      previous.step.value!,
      next,
      unsecuredEvent,
    );
    await this.eventBus.publish(event);

    return updated;
  }

  private validateExecutionInput(
    input: ExecuteProjectTransitionInput,
    current: Project,
    session: Session,
  ) {
    const { transition: transitionId, step: overrideStatus } = input;

    if (overrideStatus) {
      if (!this.canBypass(session)) {
        throw new UnauthorizedException(
          'You do not have permission to bypass workflow. Specify a transition ID instead.',
        );
      }
      return overrideStatus;
    }

    const available = this.getAvailableTransitions(current, session);
    const transition = available.find((t) => t.id === transitionId);
    if (!transition) {
      throw new UnauthorizedException('This transition is not available');
    }
    return transition;
  }
}
