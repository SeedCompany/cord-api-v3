import { node, relation } from 'cypher-query-builder';
import { ServerException } from '../../../common';
import {
  DatabaseService,
  EventsHandler,
  IEventHandler,
  ILogger,
  Logger,
} from '../../../core';
import {
  activeChangedProp,
  addPreviousLabel,
  deactivateProperty,
  variable,
} from '../../../core/database/query';
import { ProjectChangeRequestApprovedEvent } from '../../project-change-request/events';
import { IProject } from '../dto';
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
      await this.db
        .query()
        .match([
          node('node', 'Project'),
          relation('out', '', 'changeset', { active: true }),
          node('changeset', 'Changeset', { id: changesetId }),
        ])
        .match([
          node('node'),
          relation('out', 'relationToProp', { active: false }),
          node('changedProp', 'Property'),
          relation('in', '', 'changeset', { active: true }),
          node('changeset'),
        ])
        // Apply previous label to active prop
        .apply(
          addPreviousLabel(variable('type(relationToProp)'), changesetId, [
            'relationToProp',
          ])
        )
        // Deactivate active prop
        .apply(
          deactivateProperty({
            key: variable('type(relationToProp)'),
            resource: IProject,
            importVars: ['relationToProp'],
          })
        )
        // Set changed prop to active
        .apply(
          activeChangedProp(variable('type(relationToProp)'), changesetId, [
            'relationToProp',
          ])
        )
        .return('node')
        .run();
      // TODO handle relations (locations, etc.)
    } catch (exception) {
      throw new ServerException(
        'Failed to apply changeset to project',
        exception
      );
    }
  }
}
