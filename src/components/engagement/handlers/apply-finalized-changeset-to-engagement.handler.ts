import { asyncPool } from '@seedcompany/common';
import { node, relation } from 'cypher-query-builder';
import { union } from 'lodash';
import { ID, ServerException, Session } from '~/common';
import {
  DatabaseService,
  EventsHandler,
  IEventHandler,
  ILogger,
  Logger,
} from '../../../core';
import { ACTIVE, deleteBaseNode, INACTIVE } from '../../../core/database/query';
import { commitChangesetProps } from '../../changeset/commit-changeset-props.query';
import { ChangesetFinalizingEvent } from '../../changeset/events';
import { rejectChangesetProps } from '../../changeset/reject-changeset-props.query';
import { EngagementService } from '../engagement.service';

type SubscribedEvent = ChangesetFinalizingEvent;

@EventsHandler(ChangesetFinalizingEvent)
export class ApplyFinalizedChangesetToEngagement
  implements IEventHandler<SubscribedEvent>
{
  constructor(
    private readonly db: DatabaseService,
    private readonly engagementService: EngagementService,
    @Logger('engagement:change-request:finalized')
    private readonly logger: ILogger,
  ) {}

  async handle({ changeset, session }: SubscribedEvent) {
    this.logger.debug('Applying changeset props');

    try {
      // Update project engagement pending changes
      const result = await this.db
        .query()
        .match([
          node('project', 'Project'),
          relation('out', '', 'changeset', ACTIVE),
          node('changeset', 'Changeset', { id: changeset.id }),
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
              changeset.applied
                ? commitChangesetProps()
                : rejectChangesetProps(),
            )
            .return('node.id as engagementId'),
        )
        .return<{ engagementIds: ID[] }>(
          'collect(engagementId) as engagementIds',
        )
        .first();

      const newResult = await this.db
        .query()
        .match([
          node('project', 'Project'),
          relation('out', '', 'changeset', ACTIVE),
          node('changeset', 'Changeset', { id: changeset.id }),
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
            .return('node.id as engagementId'),
        )
        .return<{ engagementIds: ID[] }>(
          'collect(engagementId) as engagementIds',
        )
        .first();

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
          node('changeset', 'Changeset', { id: changeset.id }),
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
              changeset.id ? commitChangesetProps() : rejectChangesetProps(),
            )
            .return('1'),
        )
        .return('project')
        .run();

      // Remove deleting engagements
      await this.removeDeletingEngagements(changeset.id);

      // Trigger update event for all changed engagements
      // progress report sync is an example of a handler that needs to run
      const allEngagementIds = union(
        result?.engagementIds || [],
        newResult?.engagementIds || [],
      );
      await this.triggerUpdateEvent(allEngagementIds, session);
    } catch (exception) {
      throw new ServerException(
        'Failed to apply changeset to project',
        exception,
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

  async triggerUpdateEvent(ids: ID[], session: Session) {
    await asyncPool(1, ids, async (id) => {
      await this.engagementService.triggerUpdateEvent(id, session);
    });
  }
}
