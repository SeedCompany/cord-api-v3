import { node, relation } from 'cypher-query-builder';
import { DatabaseService, EventsHandler, IEventHandler } from '../../../core';
import { ProjectService, ProjectStatus, ProjectType } from '../../project';
import { ProjectUpdatedEvent } from '../../project/events';
import { EngagementStatus } from '../dto';
import { EngagementService } from '../engagement.service';

@EventsHandler(ProjectUpdatedEvent)
export class UpdateProjectStatusHandler
  implements IEventHandler<ProjectUpdatedEvent> {
  constructor(
    private readonly db: DatabaseService,
    private readonly engagementService: EngagementService,
    private readonly projectService: ProjectService
  ) {}

  async handle({ previous, updates, session }: ProjectUpdatedEvent) {
    // When the project becomes Active if it is currently InDevelopment
    const updatedProject = await this.projectService.readOne(
      updates.id,
      session
    );
    if (
      previous.status !== ProjectStatus.InDevelopment ||
      updatedProject.status !== ProjectStatus.Active
    ) {
      return;
    }

    // Update engagement status to Active
    const engagements = await this.db
      .query()
      .match([node('project', 'Project', { id: updates.id })])
      .match([
        node('project'),
        relation('out', '', 'engagement', { active: true }),
        node('engagement'),
      ])
      .return('engagement.id as id')
      .asResult<{ id: string }>()
      .run();

    await Promise.all(
      engagements.map(async (engagement) => {
        const updateInput = {
          id: engagement.id,
          status: EngagementStatus.Active,
        };
        updatedProject.type === ProjectType.Translation
          ? await this.engagementService.updateLanguageEngagement(
              updateInput,
              session
            )
          : await this.engagementService.updateInternshipEngagement(
              updateInput,
              session
            );
      })
    );
  }
}
