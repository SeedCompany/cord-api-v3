import { node, relation } from 'cypher-query-builder';
import { ID, ServerException } from '../../../common';
import {
  DatabaseService,
  EventsHandler,
  IEventHandler,
  ILogger,
  Logger,
} from '../../../core';
import { collect } from '../../../core/database/query';
import { EngagementService } from '../../engagement';
import { LanguageEngagement } from '../../engagement/dto/engagement.dto';
import { EngagementRepository } from '../../engagement/engagement.repository';
import { UpdateProject } from '../../project';
import { ProjectRepository } from '../../project/project.repository';
import { ProjectService } from '../../project/project.service';
import { PlanChangeStatus } from '../dto/plan-change-status.enum';
import { PlanChangeUpdatedEvent } from '../events';

type SubscribedEvent = PlanChangeUpdatedEvent;

@EventsHandler(PlanChangeUpdatedEvent)
export class CRUpdateProject implements IEventHandler<SubscribedEvent> {
  constructor(
    private readonly db: DatabaseService,
    private readonly projectService: ProjectService,
    private readonly projectRepo: ProjectRepository,
    private readonly engagementService: EngagementService,
    private readonly engagementRepo: EngagementRepository,
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
          relation('out', '', 'changeset', { active: true }),
          node('planChange', 'PlanChange', { id: planChange.id }),
        ])
        .return('project.id as projectId')
        .asResult<{ projectId: ID }>()
        .first();

      // Get unsecured project with changeset
      if (result?.projectId) {
        const project = await this.projectService.readOne(
          result.projectId,
          event.session
        );
        const changes = await this.projectRepo.getChangesetProps(
          result.projectId,
          planChange.id
        );

        // Update project pending changes
        const updateProject: UpdateProject = {
          ...changes,
          id: project.id,
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
            relation('in', 'changeRel', 'changeset', { active: true }),
            node('planChange'),
          ])
          .setValues({
            'engagementRel.active': true,
            'changeRel.active': false,
          })
          .run();
        const engagementsResult = await this.db
          .query()
          .match([
            node('project', 'Project', { id: result.projectId }),
            relation('out', '', 'engagement', { active: true }),
            node('engagement', 'Engagement'),
          ])
          .return(collect('engagement.id', 'engagementIds'))
          .asResult<{ engagementIds: ID[] }>()
          .first();

        engagementsResult?.engagementIds.map(async (id) => {
          const object = await this.engagementService.readOne(
            id,
            event.session
          );
          const changes = await this.engagementRepo.getChangesetProps(
            id,
            planChange.id
          );
          await this.db.updateProperties({
            type: LanguageEngagement,
            object,
            changes,
          });
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
