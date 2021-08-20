import { node, relation } from 'cypher-query-builder';
import { ServerException } from '../../../common';
import {
  DatabaseService,
  EventsHandler,
  IEventHandler,
  ILogger,
  Logger,
} from '../../../core';
import { commitChangesetProps } from '../../changeset/commit-changeset-props.query';
import { ProjectChangeRequestApprovedEvent } from '../../project-change-request/events';
import { ProjectRepository } from '../project.repository';
import { ProjectService } from '../project.service';

type SubscribedEvent = ProjectChangeRequestApprovedEvent;

@EventsHandler(ProjectChangeRequestApprovedEvent)
export class ApplyApprovedChangesetToProject
  implements IEventHandler<SubscribedEvent>
{
  constructor(
    private readonly db: DatabaseService,
    private readonly projectService: ProjectService,
    private readonly projectRepo: ProjectRepository,
    @Logger('project:change-request:approved') private readonly logger: ILogger
  ) {}

  async handle(event: SubscribedEvent) {
    this.logger.debug('Applying changeset props');

    const changesetId = event.changeRequest.id;

    try {
      const query = this.db
        .query()
        .match([
          node('node', 'Project'),
          relation('out', '', 'changeset', { active: true }),
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
              relation('out', '', 'budget', { active: true }),
              node('budget', 'Budget'),
              relation('out', 'recordRel', 'record', { active: false }),
              node('br', 'BudgetRecord'),
              relation('in', '', 'changeset', { active: true }),
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
}
