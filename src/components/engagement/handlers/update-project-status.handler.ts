import { node, relation } from 'cypher-query-builder';
import { MergeExclusive, RequireAtLeastOne } from 'type-fest';
import { Session } from '../../../common';
import { DatabaseService, EventsHandler, IEventHandler } from '../../../core';
import {
  Project,
  ProjectStatus,
  ProjectStep,
  ProjectType,
} from '../../project';
import { ProjectUpdatedEvent } from '../../project/events';
import { EngagementStatus, TerminalEngagementStatuses } from '../dto';
import { EngagementService } from '../engagement.service';

const changes: Change[] = [
  {
    from: { status: ProjectStatus.InDevelopment },
    to: { status: ProjectStatus.Active },
    newStatus: EngagementStatus.Active,
  },
  {
    to: { step: ProjectStep.Completed },
    newStatus: EngagementStatus.Completed,
  },
  {
    to: { step: ProjectStep.Rejected },
    newStatus: EngagementStatus.Rejected,
  },
  {
    to: { step: ProjectStep.DidNotDevelop },
    newStatus: EngagementStatus.DidNotDevelop,
  },
  {
    to: { step: ProjectStep.Terminated },
    newStatus: EngagementStatus.Terminated,
  },
];

type Change = RequireAtLeastOne<{ from: Condition; to: Condition }> & {
  newStatus: EngagementStatus;
};
type Condition = MergeExclusive<
  { status: ProjectStatus },
  { step: ProjectStep }
>;

const changeMatcher = (previous: Project, updated: Project) => ({
  from,
  to,
}: Change) => {
  const toMatches = to ? matches(to, updated) : !matches(from!, updated);
  const fromMatches = from ? matches(from, previous) : !matches(to!, previous);
  return toMatches && fromMatches;
};
const matches = (cond: Condition, p: Project) =>
  cond.step ? cond.step === p.step.value : cond.status === p.status;

@EventsHandler(ProjectUpdatedEvent)
export class UpdateProjectStatusHandler
  implements IEventHandler<ProjectUpdatedEvent> {
  constructor(
    private readonly db: DatabaseService,
    private readonly engagementService: EngagementService
  ) {}

  async handle({ previous, updated, updates, session }: ProjectUpdatedEvent) {
    const engagementStatus = changes.find(changeMatcher(previous, updated))
      ?.newStatus;
    if (!engagementStatus) return;

    // filter out engagements with a terminal status
    const engagements = (await this.getEngagements(updates.id)).filter(
      (e) => !TerminalEngagementStatuses.includes(e.status)
    );

    await this.updateEngagements(
      engagementStatus,
      engagements.map((e) => e.id),
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
    engagementIds: string[],
    type: ProjectType,
    session: Session
  ) {
    await Promise.all(
      engagementIds.map(async (id) => {
        const updateInput = {
          id,
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
