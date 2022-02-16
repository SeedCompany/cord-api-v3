import { node, relation } from 'cypher-query-builder';
import { ServerException } from '../../../common';
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
import { ProjectChangesetFinalizedEvent } from '../../project-change-request/events';

type SubscribedEvent = ProjectChangesetFinalizedEvent;

@EventsHandler(ProjectChangesetFinalizedEvent)
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

    try {
      let query = this.db
        .query()
        .match([
          node('node', 'Project'),
          relation('out', '', 'changeset', ACTIVE),
          node('changeset', 'Changeset', { id: changesetId }),
        ])
        .apply(
          status === ProjectChangeRequestStatus.Approved
            ? commitChangesetProps()
            : rejectChangesetProps()
        )
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
            .apply((q) =>
              status === ProjectChangeRequestStatus.Approved
                ? q.setValues({
                    'recordRel.active': true,
                  })
                : q
            )
            .with('br, changeset')
            .apply(
              status === ProjectChangeRequestStatus.Approved
                ? commitChangesetProps({ nodeVar: 'br' })
                : rejectChangesetProps({ nodeVar: 'br' })
            )
            .return('br')
        )
        .return('node');
      await query.run();

      // Apply transition project step
      query = this.db
        .query()
        .match([
          node('node', 'Project'),
          relation('out', '', 'changeset', ACTIVE),
          node('changeset', 'Changeset', { id: changesetId }),
        ])
        .subQuery((sub) =>
          sub
            .comment('Apply pending transition project step')
            .with('node, changeset')
            .match([
              node('node'),
              relation('out', 'oldTransitionRel', 'stepChange', ACTIVE),
              node('oldStepChange', 'ProjectStepChange'),
            ])
            .match([
              node('node'),
              relation('out', 'transitionRel', 'stepChange', INACTIVE),
              node('stepChange', 'ProjectStepChange'),
              relation('in', '', 'changeset', ACTIVE),
              node('changeset', 'Changeset', { id: changesetId }),
            ])
            .apply((q) =>
              status === ProjectChangeRequestStatus.Approved
                ? q.setValues({
                    'oldTransitionRel.active': false,
                    'transitionRel.active': true,
                  })
                : q
            )
            .return('stepChange')
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
}
