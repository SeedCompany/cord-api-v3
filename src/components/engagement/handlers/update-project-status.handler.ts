import { node, relation } from 'cypher-query-builder';
import { Session } from '../../../common';
import { DatabaseService, EventsHandler, IEventHandler } from '../../../core';
import { ProjectStatus, ProjectStep, ProjectType } from '../../project';
import { ProjectUpdatedEvent } from '../../project/events';
import { EngagementStatus, TerminalEngagementStatuses } from '../dto';
import { EngagementService } from '../engagement.service';

@EventsHandler(ProjectUpdatedEvent)
export class UpdateProjectStatusHandler
  implements IEventHandler<ProjectUpdatedEvent> {
  constructor(
    private readonly db: DatabaseService,
    private readonly engagementService: EngagementService
  ) {}

  async handle({ previous, updated, updates, session }: ProjectUpdatedEvent) {
    // every project status that triggers engagement status updates with accompanying engagement status
    const updateStatusTuples: Array<[ProjectStatus, EngagementStatus]> = [
      [
        ProjectStatus.Terminated,
        updated.step.value === ProjectStep.Rejected
          ? EngagementStatus.Rejected
          : EngagementStatus.Terminated,
      ],
      [ProjectStatus.DidNotDevelop, EngagementStatus.DidNotDevelop],
      [ProjectStatus.Completed, EngagementStatus.Completed],
      [ProjectStatus.Active, EngagementStatus.Active],
    ];
    // if the previous project status is the same as the updated status, we do nothing to the engagements
    const [projectStatus, engagementStatus] = updateStatusTuples.find(
      (t) => t[0] === updated.status && t[0] !== previous.status
    ) ?? [null, null];
    if (!engagementStatus) return;
    // when the project becomes Active if it is currently InDevelopment
    // we want to update all non terminal engagements to match
    if (
      projectStatus === ProjectStatus.Active &&
      previous.status !== ProjectStatus.InDevelopment
    ) {
      return;
    }
    // filter out engagements with a terminal status
    const engagements = (await this.getEngagements(updates.id)).filter(
      (e) => !TerminalEngagementStatuses.includes(e.status)
    );
    if (!engagements.length) return;
    await this.updateEngagements(
      engagementStatus,
      engagements,
      updated.type,
      session
    );
  }

  private async getEngagements(projectId: string) {
    return await this.db
      .query()
      .match([node('project', 'Project', { id: projectId })])
      .match([
        node('project'),
        relation('out', '', 'engagement', { active: true }),
        node('engagement'),
        relation('out', '', 'status', { active: true }),
        node('sn', 'Property'),
      ])
      .return('engagement.id as id, sn.value as status')
      .asResult<{ id: string; status: EngagementStatus }>()
      .run();
  }

  private async updateEngagements(
    status: EngagementStatus,
    engagements: Array<{ id: string; status: EngagementStatus }>,
    type: ProjectType,
    session: Session
  ) {
    await Promise.all(
      engagements.map(async (engagement) => {
        const updateInput = {
          id: engagement.id,
          status,
        };
        type === ProjectType.Translation
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
