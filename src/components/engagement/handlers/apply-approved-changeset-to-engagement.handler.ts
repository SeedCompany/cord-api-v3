import { node, relation } from 'cypher-query-builder';
import { ID, ServerException } from '../../../common';
import {
  DatabaseService,
  EventsHandler,
  IEventHandler,
  ILogger,
  Logger,
} from '../../../core';
import { deleteBaseNode } from '../../../core/database/query';
import { commitChangesetProps } from '../../changeset/commit-changeset-props.query';
import { EngagementService } from '../../engagement';
import { ProjectChangeRequestApprovedEvent } from '../../project-change-request/events';

type SubscribedEvent = ProjectChangeRequestApprovedEvent;

@EventsHandler(ProjectChangeRequestApprovedEvent)
export class ApplyApprovedChangesetToEngagement
  implements IEventHandler<SubscribedEvent>
{
  constructor(
    private readonly db: DatabaseService,
    private readonly service: EngagementService,
    @Logger('engagement:change-request:approved')
    private readonly logger: ILogger
  ) {}

  async handle(event: SubscribedEvent) {
    this.logger.debug('Applying changeset props');

    const changeset = event.changeRequest.id;

    try {
      // Update project engagement pending changes
      const engagements = await this.db
        .query()
        .match([
          node('project', 'Project'),
          relation('out', '', 'changeset', { active: true }),
          node('changeset', 'Changeset', { id: changeset }),
        ])
        .subQuery((sub) =>
          sub
            .with('project')
            .match([
              node('project'),
              relation('out', 'engagementRel', 'engagement', {
                active: true,
              }),
              node('node', 'Engagement'),
            ])
            .return('node')
            .union()
            .with('project, changeset')
            .match([
              node('project'),
              relation('out', 'engagementRel', 'engagement', {
                active: false,
              }),
              node('node', 'Engagement'),
              relation('in', 'changesetRel', 'changeset', { active: true }),
              node('changeset'),
            ])
            .setValues({
              'engagementRel.active': true,
            })
            .return('node')
        )
        .return<{ id: ID }>(['node.id as id'])
        .run();

      await Promise.all(
        engagements.map(async ({ id }) => {
          // Skip looping for engagements created in changeset
          await this.db
            .query()
            .match([
              node('changeset', 'Changeset', { id: changeset }),
              relation('in', '', 'changeset', { active: true }),
              node('project', 'Project'),
              relation('out', '', 'engagement', { active: true }),
              node('node', 'Engagement', { id }),
            ])
            .apply(commitChangesetProps())
            .return('node')
            .run();
        })
      );

      // Remove deleting engagements
      await this.removeDeletingEngagements(changeset);
    } catch (exception) {
      throw new ServerException(
        'Failed to apply changeset to project',
        exception
      );
    }
  }

  async removeDeletingEngagements(changeset: ID) {
    await this.db
      .query()
      .match([
        node('project', 'Project'),
        relation('out', '', 'changeset', { active: true }),
        node('changeset', 'Changeset', { id: changeset }),
      ])
      .match([
        node('project'),
        relation('out', '', 'engagement', { active: true }),
        node('node', 'Engagement'),
        relation('in', '', 'changeset', { active: true, deleting: true }),
        node('changeset'),
      ])
      .apply(deleteBaseNode('node'))
      .return<{ count: number }>('count(node) as count')
      .run();
  }
}
