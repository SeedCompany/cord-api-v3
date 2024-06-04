import { MergeExclusive, RequireAtLeastOne } from 'type-fest';
import { ID, Session, UnsecuredDto } from '~/common';
import { EventsHandler, IEventHandler } from '~/core';
import {
  Project,
  ProjectStatus,
  ProjectStep,
  ProjectType,
} from '../../project/dto';
import { ProjectUpdatedEvent } from '../../project/events';
import { EngagementStatus } from '../dto';
import { EngagementRepository } from '../engagement.repository';
import { EngagementService } from '../engagement.service';

const changes: Change[] = [
  {
    to: { status: ProjectStatus.Active },
    newStatus: EngagementStatus.Active,
  },
  {
    to: { step: ProjectStep.ActiveChangedPlan },
    newStatus: EngagementStatus.ActiveChangedPlan,
  },
  {
    from: { status: ProjectStatus.Active },
    to: { status: ProjectStatus.InDevelopment },
    newStatus: EngagementStatus.InDevelopment,
  },
  {
    to: { step: ProjectStep.DiscussingChangeToPlan },
    newStatus: EngagementStatus.DiscussingChangeToPlan,
  },
  {
    to: { step: ProjectStep.Suspended },
    newStatus: EngagementStatus.Suspended,
  },
  {
    to: { step: ProjectStep.DiscussingReactivation },
    newStatus: EngagementStatus.DiscussingReactivation,
  },
  {
    to: { step: ProjectStep.DiscussingTermination },
    newStatus: EngagementStatus.DiscussingTermination,
  },
  {
    to: { step: ProjectStep.FinalizingCompletion },
    newStatus: EngagementStatus.FinalizingCompletion,
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

const changeMatcher =
  (previous: UnsecuredDto<Project>, updated: UnsecuredDto<Project>) =>
  ({ from, to }: Change) => {
    const toMatches = to ? matches(to, updated) : !matches(from!, updated);
    const fromMatches = from
      ? matches(from, previous)
      : !matches(to!, previous);
    return toMatches && fromMatches;
  };
const matches = (cond: Condition, p: UnsecuredDto<Project>) =>
  cond.step ? cond.step === p.step : cond.status === p.status;

@EventsHandler(ProjectUpdatedEvent)
export class UpdateProjectStatusHandler
  implements IEventHandler<ProjectUpdatedEvent>
{
  constructor(
    private readonly repo: EngagementRepository,
    private readonly engagementService: EngagementService,
  ) {}

  async handle({ previous, updated, session }: ProjectUpdatedEvent) {
    const engagementStatus = changes.find(
      changeMatcher(previous, updated),
    )?.newStatus;
    if (!engagementStatus) return;

    const engagementIds = await this.repo.getOngoingEngagementIds(updated.id);

    await this.updateEngagements(
      engagementStatus,
      engagementIds,
      updated.type,
      session,
    );
  }

  private async updateEngagements(
    status: EngagementStatus,
    engagementIds: ID[],
    type: ProjectType,
    session: Session,
  ) {
    for await (const id of engagementIds) {
      const updateInput = {
        id,
        status,
      };
      type !== ProjectType.Internship
        ? await this.engagementService.updateLanguageEngagement(
            updateInput,
            session,
          )
        : await this.engagementService.updateInternshipEngagement(
            updateInput,
            session,
          );
    }
  }
}
