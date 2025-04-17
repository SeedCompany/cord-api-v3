import { node, relation } from 'cypher-query-builder';
import { ServerException } from '~/common';
import { EventsHandler, IEventHandler, ILogger, Logger } from '~/core';
import { DatabaseService } from '~/core/database';
import { ACTIVE, INACTIVE } from '~/core/database/query';
import {
  ChangesetFinalizingEvent,
  commitChangesetProps,
  rejectChangesetProps,
} from '../../changeset';

type SubscribedEvent = ChangesetFinalizingEvent;

@EventsHandler(ChangesetFinalizingEvent)
export class ApplyFinalizedChangesetToProject
  implements IEventHandler<SubscribedEvent>
{
  constructor(
    private readonly db: DatabaseService,
    @Logger('project:change-request:finalized')
    private readonly logger: ILogger,
  ) {}

  async handle({ changeset }: SubscribedEvent) {
    this.logger.debug('Applying changeset props');

    try {
      const query = this.db
        .query()
        .match([
          node('node', 'Project'),
          relation('out', '', 'changeset', ACTIVE),
          node('changeset', 'Changeset', { id: changeset.id }),
        ])
        .apply(
          changeset.applied ? commitChangesetProps() : rejectChangesetProps(),
        )
        // Apply pending budget records
        .subQuery(['node', 'changeset'], (sub) =>
          sub
            .comment('Apply pending budget records')
            .match([
              node('node'),
              relation('out', '', 'budget', ACTIVE),
              node('budget', 'Budget'),
              relation('out', 'recordRel', 'record', INACTIVE),
              node('br', 'BudgetRecord'),
              relation('in', '', 'changeset', ACTIVE),
              node('changeset', 'Changeset', { id: changeset.id }),
            ])
            .apply((q) =>
              changeset.applied
                ? q.setValues({
                    'recordRel.active': true,
                  })
                : q,
            )
            .with('br, changeset')
            .apply(
              changeset.applied
                ? commitChangesetProps({ nodeVar: 'br' })
                : rejectChangesetProps({ nodeVar: 'br' }),
            )
            .return('br'),
        )
        .return('node');
      await query.run();
      // TODO handle relations (locations, etc.)
    } catch (exception) {
      throw new ServerException(
        'Failed to apply changeset to project',
        exception,
      );
    }
  }
}
