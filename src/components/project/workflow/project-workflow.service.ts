import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import {
  ID,
  many,
  Session,
  UnauthorizedException,
  UnsecuredDto,
} from '~/common';
import { IEventBus, ResourceLoader } from '~/core';
import { Privileges } from '../../authorization';
import { Project, ProjectStep } from '../dto';
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
    private readonly moduleRef: ModuleRef,
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
        ? Object.values(Transitions).find((t) => t.key === dto.transition) ??
          null
        : null,
    };
  }

  async getAvailableTransitions(project: Project, session: Session) {
    const currentStep = project.step.value!;

    let available = Object.values(Transitions);

    // Filter out non applicable transitions
    available = available.filter((t) =>
      t.from ? many(t.from).includes(currentStep) : true,
    );

    // Filter out transitions without authorization to execute
    const p = this.privileges.for(session, WorkflowEvent);
    available = available.filter((t) =>
      // I don't have a good way to type this right now.
      // Context usage is still fuzzy when conditions need different shapes.
      p.forContext({ transition: t.key } as any).can('create'),
    );

    const params = { project, moduleRef: this.moduleRef };

    // Resolve conditions & filter as needed
    const conditions = available.flatMap((t) => t.conditions ?? []);
    const resolvedConditions = new Map(
      await Promise.all(
        [...new Set(conditions)].map(
          async (condition) =>
            [condition, await condition.resolve(params)] as const,
        ),
      ),
    );
    available = available.flatMap((t) => {
      const conditions =
        t.conditions?.map((c) => resolvedConditions.get(c)!) ?? [];
      if (conditions.some((c) => c.status === 'OMIT')) {
        return [];
      }
      if (conditions.every((c) => c.status === 'ENABLED')) {
        return t;
      }
      const disabledReasons = conditions.flatMap((c) =>
        c.status === 'DISABLED' ? c.disabledReason ?? [] : [],
      );
      return {
        ...t,
        disabled: true,
        disabledReason: disabledReasons.join('\n'), // TODO split to list
      };
    });

    // Resolve dynamic to steps
    const dynamicTos = available.flatMap((t) =>
      typeof t.to !== 'string' ? t.to : [],
    );
    const resolvedTos = new Map(
      await Promise.all(
        dynamicTos.map(async (to) => [to, await to.resolve(params)] as const),
      ),
    );
    return available.map((t) => ({
      ...t,
      to: typeof t.to !== 'string' ? resolvedTos.get(t.to)! : t.to,
    }));
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

    const next = await this.validateExecutionInput(input, previous, session);

    const unsecuredEvent = await this.repo.recordEvent(
      {
        project: projectId,
        ...(typeof next !== 'string'
          ? { transition: next.key, step: next.to }
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

  private async validateExecutionInput(
    input: ExecuteProjectTransitionInput,
    current: Project,
    session: Session,
  ) {
    const { transition: transitionKey, step: overrideStatus } = input;

    if (overrideStatus) {
      if (!this.canBypass(session)) {
        throw new UnauthorizedException(
          'You do not have permission to bypass workflow. Specify a transition ID instead.',
        );
      }
      return overrideStatus;
    }

    const available = await this.getAvailableTransitions(current, session);
    const transition = available.find((t) => t.key === transitionKey);
    if (!transition) {
      throw new UnauthorizedException('This transition is not available');
    }
    return transition;
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
