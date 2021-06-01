import { node, relation } from 'cypher-query-builder';
import { UpdateProject } from '../..';
import { CalendarDate, ID, ServerException } from '../../../../common';
import {
  DatabaseService,
  EventsHandler,
  IEventHandler,
  ILogger,
  Logger,
} from '../../../../core';
import { ProjectRepository } from '../../project.repository';
import { ProjectService } from '../../project.service';
import { PlanChangeStatus } from '../dto/plan-change-status.enum';
import { PlanChangeUpdatedEvent } from '../events';

type SubscribedEvent = PlanChangeUpdatedEvent;

@EventsHandler(PlanChangeUpdatedEvent)
export class CRUpdateProject implements IEventHandler<SubscribedEvent> {
  constructor(
    private readonly db: DatabaseService,
    private readonly projectService: ProjectService,
    private readonly projectRepo: ProjectRepository,
    @Logger('plan-change:cr-update-project') private readonly logger: ILogger
  ) {}

  async handle(event: SubscribedEvent) {
    this.logger.debug('Plan Change mutation, update project fields', {
      ...event,
      event: event.constructor.name,
    });
    const oldPlanChange = event.previous;
    const planChange = event.updated;

    if (
      oldPlanChange.status.value !== PlanChangeStatus.Pending ||
      planChange.status.value !== PlanChangeStatus.Approved
    ) {
      return;
    }

    try {
      // Get related project Id
      const result = await this.db
        .query()
        .match([
          node('project', 'Project'),
          relation('out', '', 'planChange', { active: true }),
          node('planChange', 'PlanChange', { id: planChange.id }),
        ])
        .return('project.id as projectId')
        .asResult<{ projectId: ID }>()
        .first();

      // Get unsecured project with changeId
      if (result?.projectId) {
        const project = await this.projectService.readOne(
          result.projectId,
          event.session
        );
        const changes = await this.projectRepo.getPlanChangesProps(
          result.projectId,
          planChange.id
        );

        // Update project pending changes
        const updateProject: UpdateProject = {
          ...changes,
          id: project.id,
          mouStart: changes.mouStart as CalendarDate | undefined,
          mouEnd: changes.mouEnd as CalendarDate | undefined,
          estimatedSubmission: changes.estimatedSubmission as
            | CalendarDate
            | undefined,
        };
        await this.projectService.update(
          updateProject,
          event.session,
          undefined,
          false
        );

        // Update project engagement pending changes
        await this.db
          .query()
          .match([node('planChange', 'PlanChange', { id: planChange.id })])
          .match([
            node('project', 'Project', { id: result.projectId }),
            relation('out', 'engagementRel', 'engagement', { active: false }),
            node('engagement', 'Engagement'),
            relation('in', 'changeRel', 'change', { active: true }),
            node('planChange'),
          ])
          .optionalMatch([
            node('engagement'),
            relation('out', 'propRel', { active: false }),
            node('property', 'Property'),
            relation('in', 'propChangeRel', 'change', { active: true }),
            node('planChange'),
          ])
          .setValues({
            'engagementRel.active': true,
            'changeRel.active': false,
            'propRel.active': true,
            'propChangeRel.active': false,
          })
          .run();
      }
    } catch (exception) {
      this.logger.error(`Could not update project in CR mode`, {
        userId: event.session.userId,
        exception,
      });
      throw new ServerException(
        'Could not update project in CR mode',
        exception
      );
    }
  }
}
