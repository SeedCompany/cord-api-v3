import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { ID, Session, UnsecuredDto } from '~/common';
import { IEventBus, ResourceLoader } from '~/core';
import {
  findTransition,
  WorkflowService,
} from '../../workflow/workflow.service';
import { Project, ProjectStep } from '../dto';
import {
  ExecuteProjectTransitionInput,
  ProjectWorkflowEvent as WorkflowEvent,
} from './dto';
import { ProjectTransitionedEvent } from './events/project-transitioned.event';
import { ProjectWorkflow } from './project-workflow';
import { ProjectWorkflowRepository } from './project-workflow.repository';

@Injectable()
export class ProjectWorkflowService extends WorkflowService(ProjectWorkflow) {
  constructor(
    private readonly resources: ResourceLoader,
    private readonly repo: ProjectWorkflowRepository,
    private readonly eventBus: IEventBus,
    private readonly moduleRef: ModuleRef,
  ) {
    super();
  }

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
    return {
      ...this.privileges.for(session, WorkflowEvent).secure(dto),
      transition: this.transitionByKey(dto.transition, dto.to),
    };
  }

  async getAvailableTransitions(project: Project, session: Session) {
    return await this.resolveAvailable(
      project.step.value!,
      { project, moduleRef: this.moduleRef },
      project,
      session,
    );
  }

  canBypass(session: Session) {
    return this.privileges.for(session, WorkflowEvent).can('create');
  }

  async executeTransition(
    input: ExecuteProjectTransitionInput,
    session: Session,
  ) {
    const { project: projectId, notes } = input;

    const { ProjectLoader } = await import('../project.loader');
    const projects = await this.resources.getLoader(ProjectLoader);
    const loaderKey = {
      id: projectId,
      view: { active: true },
    } as const;
    const previous = await projects.load(loaderKey);

    const next =
      this.getBypassIfValid(input, session) ??
      findTransition(
        await this.getAvailableTransitions(previous, session),
        input.transition,
      );

    const unsecuredEvent = await this.repo.recordEvent(
      {
        project: projectId,
        ...(typeof next !== 'string'
          ? { transition: next.key, to: next.to }
          : { to: next }),
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

  /** @deprecated */
  async executeTransitionLegacy(
    currentProject: Project,
    step: ProjectStep,
    session: Session,
  ) {
    const transitions = await this.getAvailableTransitions(
      currentProject,
      session,
    );
    // Pick the first matching to step.
    // Lack of detail is one of the reasons why this is legacy logic.
    const transition = transitions.find((t) => t.to === step);

    await this.executeTransition(
      {
        project: currentProject.id,
        ...(transition ? { transition: transition.key } : { bypassTo: step }),
      },
      session,
    );
  }
}
