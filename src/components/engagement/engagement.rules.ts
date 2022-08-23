/* eslint-disable no-case-declarations */
import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { first, intersection } from 'lodash';
import {
  ID,
  ServerException,
  Session,
  UnauthorizedException,
} from '../../common';
import { ConfigService, DatabaseService, ILogger, Logger } from '../../core';
import { ACTIVE, INACTIVE } from '../../core/database/query';
import { Role, withoutScope } from '../authorization';
import { ProjectStep } from '../project';
import {
  EngagementStatus,
  EngagementStatusTransition,
  EngagementTransitionType,
} from './dto';

interface Transition extends EngagementStatusTransition {
  projectStepRequirements?: ProjectStep[];
  inChangeset?: boolean;
}

interface StatusRule {
  approvers: Role[];
  transitions: Transition[];
}

const rolesThatCanBypassWorkflow: Role[] = [Role.Administrator];

@Injectable()
export class EngagementRules {
  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
    // eslint-disable-next-line @seedcompany/no-unused-vars
    @Logger('engagement:rules') private readonly logger: ILogger
  ) {}

  private async getStatusRule(
    status: EngagementStatus,
    id: ID,
    changeset?: ID
  ): Promise<StatusRule> {
    const mostRecentPreviousStatus = async (steps: EngagementStatus[]) => {
      const prevSteps = await this.getPreviousStatus(id, changeset);
      return first(intersection(prevSteps, steps)) ?? steps[0];
    };

    const backToActive = () =>
      mostRecentPreviousStatus([
        EngagementStatus.Active,
        EngagementStatus.ActiveChangedPlan,
      ]);
    switch (status) {
      case EngagementStatus.InDevelopment:
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
              to: EngagementStatus.FinalizingCompletion,
              type: EngagementTransitionType.Approve,
              label: 'Finalize Completion',
            },
            {
              to: EngagementStatus.Suspended,
              type: EngagementTransitionType.Neutral,
              label: 'Suspend',
              inChangeset: true,
            },
            {
              to: EngagementStatus.DiscussingChangeToPlan,
              type: EngagementTransitionType.Neutral,
              label: 'Discuss Change to Plan',
              inChangeset: false,
            },
            {
              to: EngagementStatus.DiscussingSuspension,
              type: EngagementTransitionType.Neutral,
              label: 'Discuss Suspension',
              inChangeset: false,
            },
            {
              to: EngagementStatus.DiscussingTermination,
              type: EngagementTransitionType.Neutral,
              label: 'Discuss Termination',
              inChangeset: false,
            },
            {
              to: EngagementStatus.Terminated,
              type: EngagementTransitionType.Neutral,
              label: 'Terminate',
              inChangeset: true,
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
              to: EngagementStatus.FinalizingCompletion,
              type: EngagementTransitionType.Approve,
              label: 'Finalize Completion',
            },
            {
              to: EngagementStatus.DiscussingChangeToPlan,
              type: EngagementTransitionType.Neutral,
              label: 'Discuss Change to Plan',
              inChangeset: false,
            },
            {
              to: EngagementStatus.Suspended,
              type: EngagementTransitionType.Neutral,
              label: 'Suspend',
              inChangeset: true,
            },
            {
              to: EngagementStatus.DiscussingTermination,
              type: EngagementTransitionType.Neutral,
              label: 'Discuss Termination',
              inChangeset: false,
            },
            {
              to: EngagementStatus.DiscussingSuspension,
              type: EngagementTransitionType.Neutral,
              label: 'Discuss Suspension',
              inChangeset: false,
            },
            {
              to: EngagementStatus.Terminated,
              type: EngagementTransitionType.Neutral,
              label: 'Terminate',
              inChangeset: true,
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
              to: await backToActive(),
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
              to: await backToActive(),
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
              inChangeset: false,
            },
            {
              to: await backToActive(),
              type: EngagementTransitionType.Approve,
              label: 'Reactivate',
              inChangeset: true,
            },
            {
              to: EngagementStatus.DiscussingTermination,
              type: EngagementTransitionType.Neutral,
              label: 'Discuss Termination',
              inChangeset: false,
            },
            {
              to: EngagementStatus.ActiveChangedPlan,
              type: EngagementTransitionType.Approve,
              label: 'Approve Change to Plan',
              inChangeset: true,
            },
            {
              to: EngagementStatus.Terminated,
              type: EngagementTransitionType.Neutral,
              label: 'Terminate',
              inChangeset: true,
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
          ],
          transitions: [
            {
              to: await backToActive(),
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
          transitions: [
            {
              to: await backToActive(),
              type: EngagementTransitionType.Neutral,
              label: 'Go back to Active',
              inChangeset: true,
            },
          ],
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
    session: Session,
    currentUserRoles?: Role[],
    changeset?: ID
  ): Promise<EngagementStatusTransition[]> {
    if (session.anonymous) {
      return [];
    }

    const currentStatus = await this.getCurrentStatus(engagementId, changeset);
    // get roles that can approve the current status
    const { approvers, transitions: originTransitions } =
      await this.getStatusRule(currentStatus, engagementId);

    const transitions = originTransitions.filter((transition) =>
      changeset ? transition.inChangeset !== false : !transition.inChangeset
    );

    // If current user is not an approver (based on roles) then don't allow any transitions
    currentUserRoles ??= session.roles.map(withoutScope);
    if (!changeset && intersection(approvers, currentUserRoles).length === 0) {
      return [];
    }

    // If transitions don't need project's step then dont fetch or filter it.
    if (
      !transitions.some(
        (transition) => transition.projectStepRequirements?.length
      )
    ) {
      return transitions;
    }

    const currentStep = await this.getCurrentProjectStep(
      engagementId,
      changeset
    );
    const availableTransitionsAccordingToProject = transitions.filter(
      (transition) =>
        !transition.projectStepRequirements?.length ||
        transition.projectStepRequirements.includes(currentStep)
    );
    return availableTransitionsAccordingToProject;
  }

  async canBypassWorkflow(session: Session) {
    const roles = session.roles.map(withoutScope);
    return intersection(rolesThatCanBypassWorkflow, roles).length > 0;
  }

  async verifyStatusChange(
    engagementId: ID,
    session: Session,
    nextStatus: EngagementStatus,
    changeset?: ID
  ) {
    // If current user's roles include a role that can bypass workflow
    // stop the check here.
    const currentUserRoles = session.roles.map(withoutScope);
    if (intersection(rolesThatCanBypassWorkflow, currentUserRoles).length > 0) {
      return;
    }

    const transitions = await this.getAvailableTransitions(
      engagementId,
      session,
      currentUserRoles,
      changeset
    );

    const validNextStatus = transitions.some(
      (transition) => transition.to === nextStatus
    );
    if (!validNextStatus) {
      throw new UnauthorizedException(
        'This status is not in an authorized sequence',
        'engagement.status'
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

  /** A list of the engagement's previous status ordered most recent to furthest in the past */
  private async getPreviousStatus(
    id: ID,
    changeset?: ID,
    includePreviousChangesetSteps = false
  ): Promise<EngagementStatus[]> {
    const result = await this.db
      .query()
      .match([
        ...(changeset && includePreviousChangesetSteps
          ? [
              node('changeset', 'Changeset', { id: changeset }),
              relation('in', '', 'changeset', ACTIVE),
            ]
          : []),
        node('node', 'Engagement', { id }),
        relation('out', '', 'status', changeset ? undefined : INACTIVE),
        node('prop'),
      ])
      .apply((q) =>
        changeset && includePreviousChangesetSteps
          ? q.raw('WHERE NOT (changeset)-[:changeset {active:true}]->(prop)')
          : q.raw('WHERE NOT (:Changeset)-[:changeset]->(prop)')
      )
      .with('prop')
      .orderBy('prop.createdAt', 'DESC')
      .return<{ status: EngagementStatus[] }>(`collect(prop.value) as status`)
      .first();
    if (!result) {
      throw new ServerException(
        "Failed to determine engagement's previous status"
      );
    }
    return result.status;
  }
}
