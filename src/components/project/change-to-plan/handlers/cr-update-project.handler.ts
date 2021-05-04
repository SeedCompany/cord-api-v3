import { node, relation } from 'cypher-query-builder';
import { entries } from 'lodash';
import { IProject } from '../..';
import { ID, ServerException } from '../../../../common';
import {
  DatabaseService,
  EventsHandler,
  IEventHandler,
  ILogger,
  Logger,
} from '../../../../core';
import { ProjectService } from '../../project.service';
import { PlanChangeStatus } from '../dto/plan-change-status.enum';
import { PlanChangeUpdatedEvent } from '../events';

type SubscribedEvent = PlanChangeUpdatedEvent;

@EventsHandler(PlanChangeUpdatedEvent)
export class CRUpdateProject implements IEventHandler<SubscribedEvent> {
  constructor(
    private readonly db: DatabaseService,
    private readonly projectService: ProjectService,
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
        const planChangesProps = await this.projectService.getPlanChangesProps(
          result.projectId,
          planChange.id
        );

        let changes = {};
        entries(planChangesProps).forEach(([key, prop]) => {
          if (prop !== undefined) {
            changes = {
              ...changes,
              [key]: prop,
            };
          }
        });

        await this.db.updateProperties({
          type: IProject,
          object: project,
          changes,
        });
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
