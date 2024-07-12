import { MergeExclusive, RequireAtLeastOne } from 'type-fest';
import { ID, Session, UnsecuredDto } from '~/common';
import { EventsHandler, IEventHandler } from '~/core';
import {
  Project,
  ProjectStatus,
  ProjectStep,
  ProjectType,
  stepToStatus,
} from '../../project/dto';
import { ProjectTransitionedEvent } from '../../project/workflow/events/project-transitioned.event';
import { EngagementStatus } from '../dto';
import { EngagementRepository } from '../engagement.repository';
import { EngagementService } from '../engagement.service';

const changes: Change[] = [
  {
    to: { step: ProjectStep.ActiveChangedPlan },
    newStatus: EngagementStatus.ActiveChangedPlan,
  },
  {
    to: { step: ProjectStep.DiscussingChangeToPlan },
    newStatus: EngagementStatus.DiscussingChangeToPlan,
  },
  {
    to: { step: ProjectStep.DiscussingSuspension },
    newStatus: EngagementStatus.DiscussingSuspension,
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
  {
    to: { status: ProjectStatus.Active },
    newStatus: EngagementStatus.Active,
  },
  {
    from: { status: ProjectStatus.Active },
    to: { status: ProjectStatus.InDevelopment },
    newStatus: EngagementStatus.InDevelopment,
  },
];

type Change = RequireAtLeastOne<{ from: Condition; to: Condition }> & {
  newStatus: EngagementStatus;
};
type Condition = MergeExclusive<
  { status: ProjectStatus },
  { step: ProjectStep }
>;

type ProjectState = Pick<UnsecuredDto<Project>, 'status' | 'step'>;
const changeMatcher = (previousStep: ProjectStep, updatedStep: ProjectStep) => {
  const previous: ProjectState = {
    step: previousStep,
    status: stepToStatus(previousStep),
  };
  const updated: ProjectState = {
    step: updatedStep,
    status: stepToStatus(updatedStep),
  };
  return ({ from, to }: Change) => {
    const toMatches = to ? matches(to, updated) : !matches(from!, updated);
    const fromMatches = from
      ? matches(from, previous)
      : !matches(to!, previous);
    return toMatches && fromMatches;
  };
};
const matches = (cond: Condition, p: ProjectState) =>
  cond.step ? cond.step === p.step : cond.status === p.status;

@EventsHandler(ProjectTransitionedEvent)
export class UpdateEngagementStatusHandler
  implements IEventHandler<ProjectTransitionedEvent>
{
  constructor(
    private readonly repo: EngagementRepository,
    private readonly engagementService: EngagementService,
  ) {}

  async handle({
    project,
    previousStep,
    workflowEvent,
    session,
  }: ProjectTransitionedEvent) {
    const engagementStatus = changes.find(
      changeMatcher(previousStep, workflowEvent.to),
    )?.newStatus;
    if (!engagementStatus) return;

    const engagementIds = await this.repo.getOngoingEngagementIds(project.id);

    await this.updateEngagements(
      engagementStatus,
      engagementIds,
      project.type,
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
