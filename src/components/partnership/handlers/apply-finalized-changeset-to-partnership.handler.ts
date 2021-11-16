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
export class ApplyFinalizedChangesetToPartnership
  implements IEventHandler<SubscribedEvent>
{
  constructor(
    private readonly db: DatabaseService,
    @Logger('partnership:change-request:finalized')
    private readonly logger: ILogger
  ) {}

  async handle(event: SubscribedEvent) {
    this.logger.debug('Applying changeset props');

    const changesetId = event.changeRequest.id;
    const status = event.changeRequest.status;

    try {
      // Update project partnership pending changes
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
              relation('out', 'partnershipRel', 'partnership', ACTIVE),
              node('node', 'Partnership'),
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
              relation('out', 'partnershipRel', 'partnership', INACTIVE),
              node('node', 'Partnership'),
              relation('in', 'changesetRel', 'changeset', ACTIVE),
              node('changeset'),
            ])
            .setValues({
              'partnershipRel.active': true,
            })
            .return('1')
        )
        .return('project')
        .run();

      // Remove deleting partnerships
      await this.removeDeletingPartnerships(changesetId);
    } catch (exception) {
      throw new ServerException(
        'Failed to apply changeset to partnership',
        exception
      );
    }
  }

  async removeDeletingPartnerships(changeset: ID) {
    await this.db
      .query()
      .match([
        node('project', 'Project'),
        relation('out', '', 'changeset', ACTIVE),
        node('changeset', 'Changeset', { id: changeset }),
      ])
      .match([
        node('project'),
        relation('out', '', 'partnership', ACTIVE),
        node('node', 'Partnership'),
        relation('in', '', 'changeset', { active: true, deleting: true }),
        node('changeset'),
      ])
      .apply(deleteBaseNode('node'))
      .return<{ count: number }>('count(node) as count')
      .run();
  }
}
