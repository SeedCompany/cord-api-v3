import { MergeExclusive, RequireAtLeastOne } from 'type-fest';
import { Session } from '../../../common';
import { EventsHandler, IEventHandler } from '../../../core';
import {
  Project,
  ProjectStatus,
  ProjectStep,
  ProjectType,
} from '../../project';
import { ProjectUpdatedEvent } from '../../project/events';
import { EngagementStatus } from '../dto';
import { EngagementRepository } from '../engagement.repository';
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
    private readonly repo: EngagementRepository,
    private readonly engagementService: EngagementService
  ) {}

  async handle({ previous, updated, session }: ProjectUpdatedEvent) {
    const engagementStatus = changes.find(changeMatcher(previous, updated))
      ?.newStatus;
    if (!engagementStatus) return;

    const engagementIds = await this.repo.getOngoingEngagementIds(updated.id);

    await this.updateEngagements(
      engagementStatus,
      engagementIds,
      updated.type,
      session
    );
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
