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
import { ProjectChangeRequestApprovedEvent } from '../../project-change-request/events';
import { PartnershipService } from '../partnership.service';

type SubscribedEvent = ProjectChangeRequestApprovedEvent;

@EventsHandler(ProjectChangeRequestApprovedEvent)
export class ApplyApprovedChangesetToPartnership
  implements IEventHandler<SubscribedEvent>
{
  constructor(
    private readonly db: DatabaseService,
    private readonly service: PartnershipService,
    @Logger('partnership:change-request:approved')
    private readonly logger: ILogger
  ) {}

  async handle(event: SubscribedEvent) {
    this.logger.debug('Applying changeset props');

    const changeset = event.changeRequest.id;

    try {
      // Update project partnership pending changes
      const partnerships = await this.db
        .query()
        .match([
          node('project', 'Project'),
          relation('out', '', 'changeset', { active: true }),
          node('changesetNode', 'Changeset', { id: changeset }),
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
              relation('in', 'changesetRel', 'changeset', { active: true }),
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
              node('changeset', 'Changeset', { id: changeset }),
              relation('in', '', 'changeset', { active: true }),
              node('project', 'Project'),
              relation('out', '', 'partnership', { active: true }),
              node('node', 'Partnership', { id }),
            ])
            .apply(commitChangesetProps())
            .return('node')
            .run();
        })
      );

      // Remove deleting partnerships
      await this.removeDeletingPartnerships(changeset);
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
        relation('out', '', 'changeset', { active: true }),
        node('changeset', 'Changeset', { id: changeset }),
      ])
      .match([
        node('project'),
        relation('out', '', 'partnership', { active: true }),
        node('node', 'Partnership'),
        relation('in', '', 'changeset', { active: true, deleting: true }),
        node('changeset'),
      ])
      .apply(deleteBaseNode('node'))
      .return<{ count: number }>('count(node) as count')
      .run();
  }
}
