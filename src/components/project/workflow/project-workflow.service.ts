import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import {
  type ID,
  type MaybeSecured,
  RequiredWhen,
  type UnsecuredDto,
  unwrapSecured,
} from '~/common';
import { IEventBus } from '~/core';
import { findTransition, WorkflowService } from '../../workflow/workflow.service';
import { IProject, type Project } from '../dto';
import { ProjectService } from '../project.service';
import { type ExecuteProjectTransitionInput, ProjectWorkflowEvent as WorkflowEvent } from './dto';
import { ProjectTransitionedEvent } from './events/project-transitioned.event';
import { ProjectWorkflow } from './project-workflow';
import { ProjectWorkflowRepository } from './project-workflow.repository';

@Injectable()
export class ProjectWorkflowService extends WorkflowService(() => ProjectWorkflow) {
  constructor(
    @Inject(forwardRef(() => ProjectService))
    private readonly projects: ProjectService & {},
    private readonly repo: ProjectWorkflowRepository,
    private readonly eventBus: IEventBus,
    private readonly moduleRef: ModuleRef,
  ) {
    super();
  }

  async list(report: Project): Promise<WorkflowEvent[]> {
    const dtos = await this.repo.list(report.id);
    return dtos.map((dto) => this.secure(dto));
  }

  async readMany(ids: readonly ID[]) {
    const dtos = await this.repo.readMany(ids);
    return dtos.map((dto) => this.secure(dto));
  }

  private secure(dto: UnsecuredDto<WorkflowEvent>): WorkflowEvent {
    return {
      ...this.privileges.for(WorkflowEvent).secure(dto),
      transition: this.transitionByKey(dto.transition, dto.to),
    };
  }

  async getAvailableTransitions(project: MaybeSecured<Project>) {
    return await this.resolveAvailable(
      unwrapSecured(project.step)!,
      { project, moduleRef: this.moduleRef },
      { ...project, project },
    );
  }

  async executeTransition(input: ExecuteProjectTransitionInput) {
    const { project: projectId, notes } = input;

    const previous = await this.projects.readOneUnsecured(projectId);

    const next =
      this.getBypassIfValid(input) ??
      findTransition(await this.getAvailableTransitions(previous), input.transition);

    const unsecuredEvent = await this.repo.recordEvent({
      project: projectId,
      ...(typeof next !== 'string' ? { transition: next.key, to: next.to } : { to: next }),
      notes,
    });

    const updated = await this.projects.readOneUnsecured(projectId);

    RequiredWhen.verify(IProject, updated);

    const event = new ProjectTransitionedEvent(updated, previous.step, next, unsecuredEvent);
    await this.eventBus.publish(event);

    return this.projects.secure(event.project);
  }
}
