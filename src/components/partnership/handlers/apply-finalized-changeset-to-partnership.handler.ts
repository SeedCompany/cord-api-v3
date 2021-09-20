import { node, relation } from 'cypher-query-builder';
import { ID, ServerException } from '../../../common';
import {
  DatabaseService,
  EventsHandler,
  IEventHandler,
  ILogger,
  Logger,
} from '../../../core';
import { ACTIVE, deleteBaseNode } from '../../../core/database/query';
import { commitChangesetProps } from '../../changeset/commit-changeset-props.query';
import { rejectChangesetProps } from '../../changeset/reject-changeset-props.query';
import { ProjectChangeRequestStatus } from '../../project-change-request/dto';
import { ProjectChangeRequestFinalizedEvent } from '../../project-change-request/events';

type SubscribedEvent = ProjectChangeRequestFinalizedEvent;

@EventsHandler(ProjectChangeRequestFinalizedEvent)
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
    if (status === ProjectChangeRequestStatus.Approved) {
      await this.approvePartnershipChangeset(changesetId);
    } else if (status === ProjectChangeRequestStatus.Rejected) {
      await this.rejectPartnershipChangeset(changesetId);
    }
  }

  async approvePartnershipChangeset(changesetId: ID) {
    try {
      // Update project partnership pending changes
      const partnerships = await this.db
        .query()
        .match([
          node('project', 'Project'),
          relation('out', '', 'changeset', ACTIVE),
          node('changesetNode', 'Changeset', { id: changesetId }),
        ])
        .subQuery((sub) =>
          sub
            .with('project')
            .match([
              node('project'),
              relation('out', 'partnershipRel', 'partnership', {
                active: true,
              }),
              node('node', 'Partnership'),
            ])
            .return('node')
            .union()
            .with('project, changesetNode')
            .match([
              node('project'),
              relation('out', 'partnershipRel', 'partnership', {
                active: false,
              }),
              node('node', 'Partnership'),
              relation('in', 'changesetRel', 'changeset', ACTIVE),
              node('changesetNode'),
            ])
            .setValues({
              'partnershipRel.active': true,
            })
            .return('node')
        )
        .return<{ id: ID }>(['node.id as id'])
        .run();

      await Promise.all(
        partnerships.map(async ({ id }) => {
          // Skip looping for partnerships created in changeset
          await this.db
            .query()
            .match([
              node('changeset', 'Changeset', { id: changesetId }),
              relation('in', '', 'changeset', ACTIVE),
              node('project', 'Project'),
              relation('out', '', 'partnership', ACTIVE),
              node('node', 'Partnership', { id }),
            ])
            .apply(commitChangesetProps())
            .return('node')
            .run();
        })
      );

      // Remove deleting partnerships
      await this.removeDeletingPartnerships(changesetId);
    } catch (exception) {
      throw new ServerException(
        'Failed to apply changeset to partnership',
        exception
      );
    }
  }

  async rejectPartnershipChangeset(changesetId: ID) {
    try {
      // Reject Project, Engagement, Partnerships and Budget records properties
      const query = this.db
        .query()
        .match([
          node('project', 'Project'),
          relation('out', '', 'changeset', ACTIVE),
          node('changeset', 'Changeset', { id: changesetId }),
        ])
        .subQuery((sub) =>
          sub
            .with('project')
            .match([
              node('project'),
              relation('out', 'partnershipRel', 'partnership', {
                active: true,
              }),
              node('partnership', 'Partnership'),
            ])
            .return('partnership')
            .union()
            .with('project, changesetNode')
            .match([
              node('project'),
              relation('out', 'partnershipRel', 'partnership', {
                active: false,
              }),
              node('partnership', 'Partnership'),
              relation('in', 'changesetRel', 'changeset', ACTIVE),
              node('changesetNode'),
            ])
            .apply(rejectChangesetProps({ nodeVar: 'partnership' }))
            .return('partnership')
        )
        .return('project');
      await query.run();
    } catch (exception) {
      throw new ServerException(
        'Failed to reject changeset to partnership',
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
