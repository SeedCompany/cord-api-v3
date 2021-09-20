import { node, relation } from 'cypher-query-builder';
import { ID, ServerException } from '../../../common';
import {
  DatabaseService,
  EventsHandler,
  IEventHandler,
  ILogger,
  Logger,
} from '../../../core';
import { ACTIVE, INACTIVE } from '../../../core/database/query';
import { commitChangesetProps } from '../../changeset/commit-changeset-props.query';
import { rejectChangesetProps } from '../../changeset/reject-changeset-props.query';
import { ProjectChangeRequestStatus } from '../../project-change-request/dto';
import { ProjectChangeRequestFinalizedEvent } from '../../project-change-request/events';

type SubscribedEvent = ProjectChangeRequestFinalizedEvent;

@EventsHandler(ProjectChangeRequestFinalizedEvent)
export class ApplyFinalizedChangesetToProject
  implements IEventHandler<SubscribedEvent>
{
  constructor(
    private readonly db: DatabaseService,
    @Logger('project:change-request:finalized') private readonly logger: ILogger
  ) {}

  async handle(event: SubscribedEvent) {
    this.logger.debug('Applying changeset props');

    const changesetId = event.changeRequest.id;
    const status = event.changeRequest.status;
    if (status === ProjectChangeRequestStatus.Approved) {
      await this.approveProjectChangeset(changesetId);
    } else if (status === ProjectChangeRequestStatus.Rejected) {
      await this.rejectProjectChangeset(changesetId);
    }
  }

  async approveProjectChangeset(changesetId: ID) {
    try {
      const query = this.db
        .query()
        .match([
          node('node', 'Project'),
          relation('out', '', 'changeset', ACTIVE),
          node('changeset', 'Changeset', { id: changesetId }),
        ])
        .apply(commitChangesetProps())
        // Apply pending budget records
        .subQuery((sub) =>
          sub
            .comment('Apply pending budget records')
            .with('node, changeset')
            .match([
              node('node'),
              relation('out', '', 'budget', ACTIVE),
              node('budget', 'Budget'),
              relation('out', 'recordRel', 'record', INACTIVE),
              node('br', 'BudgetRecord'),
              relation('in', '', 'changeset', ACTIVE),
              node('changeset', 'Changeset', { id: changesetId }),
            ])
            .setValues({
              'recordRel.active': true,
            })
            .with('br, changeset')
            .apply(commitChangesetProps({ nodeVar: 'br' }))
            .return('br')
        )
        .return('node');
      await query.run();
      // TODO handle relations (locations, etc.)
    } catch (exception) {
      throw new ServerException(
        'Failed to apply changeset to project',
        exception
      );
    }
  }

  async rejectProjectChangeset(changesetId: ID) {
    try {
      // Reject Project and Budget records properties
      const query = this.db
        .query()
        .match([
          node('project', 'Project'),
          relation('out', '', 'changeset', ACTIVE),
          node('changeset', 'Changeset', { id: changesetId }),
        ])
        .apply(rejectChangesetProps())
        .subQuery((sub) =>
          sub
            .with('project, changeset')
            .match([
              node('project'),
              relation('out', '', 'budget', ACTIVE),
              node('budget', 'Budget'),
              relation('out', 'recordRel', 'record', INACTIVE),
              node('br', 'BudgetRecord'),
              relation('in', '', 'changeset', ACTIVE),
              node('changeset', 'Changeset', { id: changesetId }),
            ])
            .apply(rejectChangesetProps({ nodeVar: 'br' }))
            .return('br')
        )
        .return('project');
      await query.run();
    } catch (exception) {
      throw new ServerException(
        'Failed to reject changeset to project',
        exception
      );
    }
  }
}
