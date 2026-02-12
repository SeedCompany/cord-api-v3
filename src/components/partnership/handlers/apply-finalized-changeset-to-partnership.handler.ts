import { node, relation } from 'cypher-query-builder';
import { type ID, ServerException } from '~/common';
import { DatabaseService } from '~/core/database';
import { ACTIVE, deleteBaseNode, INACTIVE } from '~/core/database/query';
import { OnHook } from '~/core/hooks';
import { ILogger, Logger } from '~/core/logger';
import {
  ChangesetFinalizingHook,
  commitChangesetProps,
  rejectChangesetProps,
} from '../../changeset';

type SubscribedEvent = ChangesetFinalizingHook;

@OnHook(ChangesetFinalizingHook)
export class ApplyFinalizedChangesetToPartnership {
  constructor(
    private readonly db: DatabaseService,
    @Logger('partnership:change-request:finalized')
    private readonly logger: ILogger,
  ) {}

  async handle({ changeset }: SubscribedEvent) {
    this.logger.debug('Applying changeset props');

    try {
      // Update project partnership pending changes
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
              relation('out', 'partnershipRel', 'partnership', ACTIVE),
              node('node', 'Partnership'),
            ])
            .apply(
              changeset.applied
                ? commitChangesetProps()
                : rejectChangesetProps(),
            )
            .return('1 as one'),
        )
        .return('project')
        .run();

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
              relation('out', 'partnershipRel', 'partnership', INACTIVE),
              node('node', 'Partnership'),
              relation('in', 'changesetRel', 'changeset', ACTIVE),
              node('changeset'),
            ])
            .setValues({
              'partnershipRel.active': true,
            })
            .return('1 as one'),
        )
        .return('project')
        .run();

      // Remove deleting partnerships
      await this.removeDeletingPartnerships(changeset.id);
    } catch (exception) {
      throw new ServerException(
        'Failed to apply changeset to partnership',
        exception,
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
