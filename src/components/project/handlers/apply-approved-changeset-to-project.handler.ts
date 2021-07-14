import { node } from 'cypher-query-builder';
import { keys } from 'lodash';
import { ServerException } from '../../../common';
import {
  DatabaseService,
  EventsHandler,
  IEventHandler,
  ILogger,
  Logger,
} from '../../../core';
import { DbChanges } from '../../../core/database/changes';
import {
  activeChangedProp,
  addPreviousLabel,
  deactivateProperty,
} from '../../../core/database/query';
import { ProjectChangeRequestApprovedEvent } from '../../project-change-request/events';
import { InternshipProject, ProjectType, TranslationProject } from '../dto';
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
      const changes = await this.projectRepo.getChangesetProps(changesetId);
      if (!changes) {
        return; // if nothing changed, nothing to do
      }
      const { id, createdAt, type, financialReportPeriod, ...actualChanges } =
        changes;

      await Promise.all(
        keys(actualChanges).map(async (key) => {
          const query = this.db
            .query()
            .match(node('node', 'Project', { id }))
            // Apply previous label to active prop
            .apply(addPreviousLabel(key, changesetId))
            // Deactivate active prop
            .apply(
              deactivateProperty({
                key: key as keyof Omit<
                  DbChanges<TranslationProject | InternshipProject>,
                  'canDelete'
                >,
                resource:
                  type === ProjectType.Translation
                    ? TranslationProject
                    : InternshipProject,
              })
            )
            // Set changed prop to active
            .apply(activeChangedProp(key, changesetId))
            .return('node');

          await query.run();
        })
      );

      // TODO
      // const query = this.db
      //   .query()
      //   .match([
      //     node('node', 'Project'),
      //     relation('out', '', 'changeset', { active: true }),
      //     node('changeset', 'Changeset', { id: changesetId }),
      //   ])
      //   .apply(matchProps({ changeset: changesetId, optional: true }))
      //   .with('props')
      //   .forEach('prop', 'props', (prop) =>
      //     prop
      //       // Deactivate active property
      //       .apply(
      //         deactivateProperty({
      //           key: variable('type(prop)').name as DbChanges<
      //             TranslationProject | InternshipProject
      //           >,
      //           resource:
      //             currentProject.type === ProjectType.Translation
      //               ? TranslationProject
      //               : InternshipProject,
      //         })
      //       )
      //   );

      // TODO handle relations (locations, etc.)
    } catch (exception) {
      throw new ServerException(
        'Failed to apply changeset to project',
        exception
      );
    }
  }
}
