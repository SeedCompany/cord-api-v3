import { node, relation } from 'cypher-query-builder';
import { ID, ServerException } from '../../../common';
import {
  DatabaseService,
  EventsHandler,
  IEventHandler,
  ILogger,
  Logger,
} from '../../../core';
import { ACTIVE, deleteBaseNode, INACTIVE } from '../../../core/database/query';
import { commitChangesetProps } from '../../changeset/commit-changeset-props.query';
import { rejectChangesetProps } from '../../changeset/reject-changeset-props.query';
import { ProjectChangeRequestStatus } from '../../project-change-request/dto';
import { ProjectChangesetFinalizedEvent } from '../../project-change-request/events';

type SubscribedEvent = ProjectChangesetFinalizedEvent;

@EventsHandler(ProjectChangesetFinalizedEvent)
export class ApplyFinalizedChangesetToEngagement
  implements IEventHandler<SubscribedEvent>
{
  constructor(
    private readonly db: DatabaseService,
    @Logger('engagement:change-request:finalized')
    private readonly logger: ILogger
  ) {}

  async handle(event: SubscribedEvent) {
    this.logger.debug('Applying changeset props');

    const changesetId = event.changeRequest.id;
    const status = event.changeRequest.status;

    try {
      // Update project engagement pending changes
      await this.db
        .query()
        .match([
          node('project', 'Project'),
          relation('out', '', 'changeset', ACTIVE),
          node('changeset', 'Changeset', { id: changesetId }),
        ])
        .subQuery((sub) =>
          sub
            .with('project, changeset')
            .match([
              node('project'),
              relation('out', 'engagementRel', 'engagement', ACTIVE),
              node('node', 'Engagement'),
            ])
            .apply(
              status === ProjectChangeRequestStatus.Approved
                ? commitChangesetProps()
                : rejectChangesetProps()
            )
            .return('1')
        )
        .return('project')
        .run();

      await this.db
        .query()
        .match([
          node('project', 'Project'),
          relation('out', '', 'changeset', ACTIVE),
          node('changeset', 'Changeset', { id: changesetId }),
        ])
        .subQuery((sub) =>
          sub
            .with('project, changeset')
            .match([
              node('project'),
              relation('out', 'engagementRel', 'engagement', INACTIVE),
              node('node', 'Engagement'),
              relation('in', 'changesetRel', 'changeset', ACTIVE),
              node('changeset'),
            ])
            .setValues({
              'engagementRel.active': true,
            })
            .return('1')
        )
        .return('project')
        .run();

      /**
       * Apply Language changes
       * Even if the LanguageEngagement is created in changesets,
       * We need to commit changes because Language Node is not connected directly with Changeset
       */
      await this.db
        .query()
        .match([
          node('project', 'Project'),
          relation('out', '', 'changeset', ACTIVE),
          node('changeset', 'Changeset', { id: changesetId }),
        ])
        .subQuery((sub) =>
          sub
            .with('project, changeset')
            .match([
              node('project'),
              relation('out', 'engagement', ACTIVE),
              node('le', 'LanguageEngagement'),
              relation('out', '', 'language', ACTIVE),
              node('node', 'Language'),
            ])
            .apply(
              status === ProjectChangeRequestStatus.Approved
                ? commitChangesetProps()
                : rejectChangesetProps()
            )
            .return('1')
        )
        .return('project')
        .run();

      // Remove deleting engagements
      await this.removeDeletingEngagements(changesetId);
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
        relation('out', '', 'changeset', ACTIVE),
        node('changeset', 'Changeset', { id: changeset }),
      ])
      .match([
        node('project'),
        relation('out', '', 'engagement', ACTIVE),
        node('node', 'Engagement'),
        relation('in', '', 'changeset', { active: true, deleting: true }),
        node('changeset'),
      ])
      .apply(deleteBaseNode('node'))
      .return<{ count: number }>('count(node) as count')
      .run();
  }
}
