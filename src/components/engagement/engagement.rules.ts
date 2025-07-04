/* eslint-disable no-case-declarations */
import { Injectable } from '@nestjs/common';
import { type NonEmptyArray, setOf } from '@seedcompany/common';
import { node, relation } from 'cypher-query-builder';
import { first, intersection } from 'lodash';
import {
  type ID,
  Role,
  ServerException,
  UnauthorizedException,
} from '~/common';
import { ILogger, Logger } from '~/core';
import { Identity } from '~/core/authentication';
import { DatabaseService } from '~/core/database';
import { ACTIVE, INACTIVE } from '~/core/database/query';
import { ProjectStep } from '../project/dto';
import {
  EngagementStatus,
  type EngagementStatusTransition,
  EngagementTransitionType,
} from './dto';

interface Transition extends EngagementStatusTransition {
  projectStepRequirements?: ProjectStep[];
}

interface StatusRule {
  approvers: Role[];
  transitions: Transition[];
}

const rolesThatCanBypassWorkflow = setOf<Role>([Role.Administrator]);

@Injectable()
export class EngagementRules {
  constructor(
    private readonly db: DatabaseService,
    private readonly identity: Identity,
    // eslint-disable-next-line @seedcompany/no-unused-vars
    @Logger('engagement:rules') private readonly logger: ILogger,
  ) {}

  private async getStatusRule(
    status: EngagementStatus,
    id: ID,
  ): Promise<StatusRule> {
    const mostRecentPreviousStatus = (steps: NonEmptyArray<EngagementStatus>) =>
      this.getMostRecentPreviousStatus(id, steps);

    switch (status) {
      case EngagementStatus.InDevelopment:
        return {
          approvers: [
            Role.Administrator,
            Role.ProjectManager,
            Role.RegionalDirector,
            Role.FieldOperationsDirector,
            Role.Controller,
            Role.MultiplicationFinanceApprover,
          ],
          transitions: [
            {
              to: EngagementStatus.Active,
              type: EngagementTransitionType.Approve,
              label: 'Approve',
              projectStepRequirements: [ProjectStep.Active],
            },
            {
              to: EngagementStatus.DidNotDevelop,
              type: EngagementTransitionType.Reject,
              label: 'End Development',
              projectStepRequirements: [ProjectStep.DidNotDevelop],
            },
            {
              to: EngagementStatus.Rejected,
              type: EngagementTransitionType.Reject,
              label: 'Reject',
              projectStepRequirements: [ProjectStep.Rejected],
            },
          ],
        };
      case EngagementStatus.Active:
        return {
          approvers: [
            Role.Administrator,
            Role.ProjectManager,
            Role.RegionalDirector,
            Role.FieldOperationsDirector, //Zone Director
          ],
          transitions: [
            {
              to: EngagementStatus.DiscussingChangeToPlan,
              type: EngagementTransitionType.Neutral,
              label: 'Discuss Change to Plan',
            },
            {
              to: EngagementStatus.DiscussingSuspension,
              type: EngagementTransitionType.Neutral,
              label: 'Discuss Suspension',
            },
            {
              to: EngagementStatus.DiscussingTermination,
              type: EngagementTransitionType.Neutral,
              label: 'Discuss Termination',
            },
            {
              to: EngagementStatus.FinalizingCompletion,
              type: EngagementTransitionType.Approve,
              label: 'Finalize Completion',
            },
          ],
        };
      case EngagementStatus.ActiveChangedPlan:
        return {
          approvers: [
            Role.Administrator,
            Role.ProjectManager,
            Role.RegionalDirector,
            Role.FieldOperationsDirector, //Zone Director
          ],
          transitions: [
            {
              to: EngagementStatus.DiscussingChangeToPlan,
              type: EngagementTransitionType.Neutral,
              label: 'Discuss Change to Plan',
            },
            {
              to: EngagementStatus.DiscussingTermination,
              type: EngagementTransitionType.Neutral,
              label: 'Discuss Termination',
            },
            {
              to: EngagementStatus.DiscussingSuspension,
              type: EngagementTransitionType.Neutral,
              label: 'Discuss Suspension',
            },
            {
              to: EngagementStatus.FinalizingCompletion,
              type: EngagementTransitionType.Approve,
              label: 'Finalize Completion',
            },
          ],
        };
      case EngagementStatus.DiscussingChangeToPlan:
        return {
          approvers: [
            Role.Administrator,
            Role.ProjectManager,
            Role.RegionalDirector,
            Role.FieldOperationsDirector,
            Role.Controller,
          ],
          transitions: [
            {
              to: EngagementStatus.DiscussingSuspension,
              type: EngagementTransitionType.Neutral,
              label: 'Discuss Suspension',
            },
            {
              to: EngagementStatus.ActiveChangedPlan,
              type: EngagementTransitionType.Approve,
              label: 'Approve Change to Plan',
            },
            {
              to: await mostRecentPreviousStatus([
                EngagementStatus.Active,
                EngagementStatus.ActiveChangedPlan,
              ]),
              type: EngagementTransitionType.Neutral,
              label: 'Will Not Change Plan',
            },
          ],
        };
      case EngagementStatus.DiscussingSuspension:
        return {
          approvers: [
            Role.Administrator,
            Role.ProjectManager,
            Role.RegionalDirector,
            Role.FieldOperationsDirector,
          ],
          transitions: [
            {
              to: EngagementStatus.Suspended,
              type: EngagementTransitionType.Approve,
              label: 'Approve Suspension',
            },
            {
              to: await mostRecentPreviousStatus([
                EngagementStatus.Active,
                EngagementStatus.ActiveChangedPlan,
              ]),
              type: EngagementTransitionType.Neutral,
              label: 'Will Not Suspend',
            },
            {
              to: EngagementStatus.DiscussingTermination,
              type: EngagementTransitionType.Neutral,
              label: 'Discussing Termination',
            },
          ],
        };
      case EngagementStatus.Suspended:
        return {
          approvers: [
            Role.Administrator,
            Role.ProjectManager,
            Role.RegionalDirector,
            Role.FieldOperationsDirector,
          ],
          transitions: [
            {
              to: EngagementStatus.DiscussingReactivation,
              type: EngagementTransitionType.Neutral,
              label: 'Discuss Reactivation',
            },
            {
              to: EngagementStatus.DiscussingTermination,
              type: EngagementTransitionType.Neutral,
              label: 'Discuss Termination',
            },
          ],
        };
      case EngagementStatus.DiscussingReactivation:
        return {
          approvers: [
            Role.Administrator,
            Role.ProjectManager,
            Role.RegionalDirector,
            Role.FieldOperationsDirector,
          ],
          transitions: [
            {
              to: EngagementStatus.ActiveChangedPlan,
              type: EngagementTransitionType.Approve,
              label: 'Approve ReActivation',
            },
            {
              to: EngagementStatus.DiscussingTermination,
              type: EngagementTransitionType.Neutral,
              label: 'Discuss Termination',
            },
          ],
        };
      case EngagementStatus.DiscussingTermination:
        return {
          approvers: [
            Role.Administrator,
            Role.ProjectManager,
            Role.RegionalDirector,
            Role.FieldOperationsDirector,
          ],
          transitions: [
            {
              to: await mostRecentPreviousStatus([
                EngagementStatus.Active,
                EngagementStatus.ActiveChangedPlan,
                EngagementStatus.DiscussingReactivation,
                EngagementStatus.Suspended,
              ]),
              type: EngagementTransitionType.Neutral,
              label: 'Will Not Terminate',
            },
            {
              to: EngagementStatus.Terminated,
              type: EngagementTransitionType.Approve,
              label: 'Approve Termination',
            },
          ],
        };
      case EngagementStatus.FinalizingCompletion:
        return {
          approvers: [
            Role.Administrator,
            Role.ProjectManager,
            Role.RegionalDirector,
            Role.FieldOperationsDirector,
            Role.FinancialAnalyst,
            Role.LeadFinancialAnalyst,
          ],
          transitions: [
            {
              to: await mostRecentPreviousStatus([
                EngagementStatus.Active,
                EngagementStatus.ActiveChangedPlan,
              ]),
              type: EngagementTransitionType.Neutral,
              label: 'Still Working',
            },
            {
              to: EngagementStatus.Completed,
              type: EngagementTransitionType.Approve,
              label: 'Complete 🎉',
            },
          ],
        };
      case EngagementStatus.Terminated:
        return {
          approvers: [Role.Administrator],
          transitions: [],
        };
      case EngagementStatus.Completed:
        return {
          approvers: [Role.Administrator],
          transitions: [],
        };
      default:
        return {
          approvers: [Role.Administrator],
          transitions: [],
        };
    }
  }

  async getAvailableTransitions(
    engagementId: ID,
    changeset?: ID,
  ): Promise<EngagementStatusTransition[]> {
    const session = this.identity.current;
    if (session.anonymous) {
      return [];
    }

    const currentStatus = await this.getCurrentStatus(engagementId, changeset);
    // get roles that can approve the current status
    const { approvers, transitions } = await this.getStatusRule(
      currentStatus,
      engagementId,
    );

    // If current user is not an approver (based on roles) then don't allow any transitions
    if (session.roles.intersection(setOf(approvers)).size === 0) {
      return [];
    }

    // If transitions don't need project's step then dont fetch or filter it.
    if (
      !transitions.some(
        (transition) => transition.projectStepRequirements?.length,
      )
    ) {
      return transitions;
    }

    const currentStep = await this.getCurrentProjectStep(
      engagementId,
      changeset,
    );
    const availableTransitionsAccordingToProject = transitions.filter(
      (transition) =>
        !transition.projectStepRequirements?.length ||
        transition.projectStepRequirements.includes(currentStep),
    );
    return availableTransitionsAccordingToProject;
  }

  canBypassWorkflow() {
    const { roles } = this.identity.current;
    return roles.intersection(rolesThatCanBypassWorkflow).size > 0;
  }

  async verifyStatusChange(
    engagementId: ID,
    nextStatus: EngagementStatus,
    changeset?: ID,
  ) {
    if (this.canBypassWorkflow()) {
      return;
    }

    const transitions = await this.getAvailableTransitions(
      engagementId,
      changeset,
    );

    const validNextStatus = transitions.some(
      (transition) => transition.to === nextStatus,
    );
    if (!validNextStatus) {
      throw new UnauthorizedException(
        `One or more engagements cannot be changed to ${
          EngagementStatus.entry(nextStatus).label
        }. Please check engagement statuses.`,
        'engagement.status',
      );
    }
  }

  private async getCurrentStatus(id: ID, changeset?: ID) {
    let currentStatus;

    if (changeset) {
      const result = await this.db
        .query()
        .match([
          node('engagement', 'Engagement', { id }),
          relation('out', '', 'status', INACTIVE),
          node('status', 'Property'),
          relation('in', '', 'changeset', ACTIVE),
          node('', 'Changeset', { id: changeset }),
        ])
        .raw('return status.value as status')
        .asResult<{ status: EngagementStatus }>()
        .first();
      currentStatus = result?.status;
    }
    if (!currentStatus) {
      const result = await this.db
        .query()
        .match([
          node('engagement', 'Engagement', { id }),
          relation('out', '', 'status', ACTIVE),
          node('status', 'Property'),
        ])
        .raw('return status.value as status')
        .asResult<{ status: EngagementStatus }>()
        .first();
      currentStatus = result?.status;
    }

    if (!currentStatus) {
      throw new ServerException('current status not found');
    }

    return currentStatus;
  }

  private async getCurrentProjectStep(engagementId: ID, changeset?: ID) {
    const result = await this.db
      .query()
      .match([
        node('engagement', 'Engagement', { id: engagementId }),
        relation('in', '', 'engagement'), // Removed active true due to changeset aware
        node('project', 'Project'),
      ])
      .raw('return project.id as projectId')
      .asResult<{ projectId: ID }>()
      .first();

    if (!result?.projectId) {
      throw new ServerException(`Could not find project`);
    }
    const projectId = result.projectId;

    let currentStep;
    if (changeset) {
      const result = await this.db
        .query()
        .match([
          node('project', 'Project', { id: projectId }),
          relation('out', '', 'step', INACTIVE),
          node('step', 'Property'),
          relation('in', '', 'changeset', ACTIVE),
          node('', 'Changeset', { id: changeset }),
        ])
        .raw('return step.value as step')
        .asResult<{ step: ProjectStep }>()
        .first();
      currentStep = result?.step;
    }
    if (!currentStep) {
      const result = await this.db
        .query()
        .match([
          node('project', 'Project', { id: projectId }),
          relation('out', '', 'step', ACTIVE),
          node('step', 'Property'),
        ])
        .raw('return step.value as step')
        .asResult<{ step: ProjectStep }>()
        .first();
      currentStep = result?.step;
    }

    if (!currentStep) {
      throw new ServerException(`Could not find project's step`);
    }

    return currentStep;
  }

  /** Of the given status which one was the most recent previous status */
  private async getMostRecentPreviousStatus(
    id: ID,
    statuses: NonEmptyArray<EngagementStatus>,
  ): Promise<EngagementStatus> {
    const prevStatus = await this.getPreviousStatus(id);
    return first(intersection(prevStatus, statuses)) ?? statuses[0];
  }

  /** A list of the engagement's previous status ordered most recent to furthest in the past */
  private async getPreviousStatus(id: ID) {
    const result = await this.db
      .query()
      .match([
        node('node', 'Engagement', { id }),
        relation('out', '', 'status', INACTIVE),
        node('prop'),
      ])
      .with('prop')
      .orderBy('prop.createdAt', 'DESC')
      .return<{ status: NonEmptyArray<EngagementStatus> }>(
        'collect(prop.value) as status',
      )
      .first();
    if (!result) {
      throw new ServerException(
        "Failed to determine engagement's previous status",
      );
    }
    return result.status;
  }
}
