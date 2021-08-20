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
import { Role } from '../authorization';
import { ProjectService, ProjectStep } from '../project';
import {
  EngagementStatus,
  EngagementStatusTransition,
  EngagementTransitionType,
} from './dto';

interface Transition extends EngagementStatusTransition {
  projectStepRequirements?: ProjectStep[];
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
    private readonly projectService: ProjectService,
    // eslint-disable-next-line @seedcompany/no-unused-vars
    @Logger('engagement:rules') private readonly logger: ILogger
  ) {}

  private async getStatusRule(
    status: EngagementStatus,
    id: ID
  ): Promise<StatusRule> {
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
              to: EngagementStatus.DiscussingChangeToPlan,
              type: EngagementTransitionType.Neutral,
              label: 'Discuss Change to Plan',
              projectStepRequirements: [ProjectStep.DiscussingChangeToPlan],
            },
            {
              to: EngagementStatus.DiscussingSuspension,
              type: EngagementTransitionType.Neutral,
              label: 'Discuss Suspension',
              projectStepRequirements: [
                ProjectStep.DiscussingChangeToPlan,
                ProjectStep.DiscussingSuspension,
              ],
            },
            {
              to: EngagementStatus.DiscussingTermination,
              type: EngagementTransitionType.Neutral,
              label: 'Discuss Termination',
              projectStepRequirements: [
                ProjectStep.DiscussingChangeToPlan,
                ProjectStep.DiscussingSuspension,
                ProjectStep.DiscussingTermination,
              ],
            },
            {
              to: EngagementStatus.FinalizingCompletion,
              type: EngagementTransitionType.Approve,
              label: 'Finalize Completion',
              projectStepRequirements: [
                ProjectStep.Active,
                ProjectStep.FinalizingCompletion,
              ],
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
              projectStepRequirements: [ProjectStep.DiscussingChangeToPlan],
            },
            {
              to: EngagementStatus.DiscussingTermination,
              type: EngagementTransitionType.Neutral,
              label: 'Discuss Termination',
              projectStepRequirements: [
                ProjectStep.DiscussingChangeToPlan,
                ProjectStep.DiscussingSuspension,
                ProjectStep.DiscussingTermination,
              ],
            },
            {
              to: EngagementStatus.DiscussingSuspension,
              type: EngagementTransitionType.Neutral,
              label: 'Discuss Suspension',
              projectStepRequirements: [
                ProjectStep.DiscussingChangeToPlan,
                ProjectStep.DiscussingSuspension,
              ],
            },
            {
              to: EngagementStatus.FinalizingCompletion,
              type: EngagementTransitionType.Approve,
              label: 'Finalize Completion',
              projectStepRequirements: [
                ProjectStep.Active,
                ProjectStep.FinalizingCompletion,
              ],
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
          ],
          transitions: [
            {
              to: EngagementStatus.DiscussingSuspension,
              type: EngagementTransitionType.Neutral,
              label: 'Discuss Suspension',
              projectStepRequirements: [
                ProjectStep.DiscussingChangeToPlan,
                ProjectStep.DiscussingSuspension,
              ],
            },
            {
              to: EngagementStatus.ActiveChangedPlan,
              type: EngagementTransitionType.Approve,
              label: 'Approve Change to Plan',
              projectStepRequirements: [ProjectStep.DiscussingChangeToPlan],
            },
            {
              to: await this.getMostRecentPreviousStatus(id, [
                EngagementStatus.Active,
                EngagementStatus.ActiveChangedPlan,
              ]),
              type: EngagementTransitionType.Neutral,
              label: 'Will Not Change Plan',
              projectStepRequirements: [ProjectStep.DiscussingChangeToPlan],
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
              projectStepRequirements: [
                ProjectStep.DiscussingChangeToPlan,
                ProjectStep.DiscussingSuspension,
              ],
            },
            {
              to: await this.getMostRecentPreviousStatus(id, [
                EngagementStatus.Active,
                EngagementStatus.ActiveChangedPlan,
              ]),
              type: EngagementTransitionType.Neutral,
              label: 'Will Not Suspend',
              projectStepRequirements: [
                ProjectStep.DiscussingChangeToPlan,
                ProjectStep.DiscussingSuspension,
              ],
            },
            {
              to: EngagementStatus.DiscussingTermination,
              type: EngagementTransitionType.Neutral,
              label: 'Discussing Termination',
              projectStepRequirements: [
                ProjectStep.DiscussingChangeToPlan,
                ProjectStep.DiscussingSuspension,
                ProjectStep.DiscussingTermination,
              ],
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
              to: await this.getMostRecentPreviousStatus(id, [
                EngagementStatus.DiscussingReactivation,
                EngagementStatus.Suspended,
                EngagementStatus.Active,
                EngagementStatus.ActiveChangedPlan,
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
              to: await this.getMostRecentPreviousStatus(id, [
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
    session: Session,
    currentUserRoles?: Role[],
    changeset?: ID
  ): Promise<EngagementStatusTransition[]> {
    if (session.anonymous) {
      return [];
    }

    const currentStatus = await this.getCurrentStatus(engagementId, changeset);
    // get roles that can approve the current status
    const { approvers, transitions } = await this.getStatusRule(
      currentStatus,
      engagementId
    );

    // If current user is not an approver (based on roles) then don't allow any transitions
    currentUserRoles ??= await this.getUserRoles(session.userId);
    if (intersection(approvers, currentUserRoles).length === 0) {
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
    const roles = await this.getUserRoles(session.userId);
    return intersection(rolesThatCanBypassWorkflow, roles).length > 0;
  }

  async verifyStatusChange(
    engagementId: ID,
    session: Session,
    nextStatus: EngagementStatus,
    changeset?: ID
  ) {
    if (this.config.migration) {
      return;
    }

    // If current user's roles include a role that can bypass workflow
    // stop the check here.
    const currentUserRoles = await this.getUserRoles(session.userId);
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
          relation('out', '', 'status', { active: false }),
          node('status', 'Property'),
          relation('in', '', 'changeset', { active: true }),
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
          relation('out', '', 'status', { active: true }),
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
          relation('out', '', 'step', { active: false }),
          node('step', 'Property'),
          relation('in', '', 'changeset', { active: true }),
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
          relation('out', '', 'step', { active: true }),
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

  private async getUserRoles(id: ID) {
    const userRolesQuery = await this.db
      .query()
      .match([
        node('user', 'User', { id }),
        relation('out', '', 'roles', { active: true }),
        node('roles', 'Property'),
      ])
      .raw('return collect(roles.value) as roles')
      .asResult<{ roles: Role[] }>()
      .first();

    return userRolesQuery?.roles ?? [];
  }

  /** Of the given status which one was the most recent previous status */
  private async getMostRecentPreviousStatus(
    id: ID,
    status: EngagementStatus[]
  ): Promise<EngagementStatus> {
    const prevStatus = await this.getPreviousStatus(id);
    const mostRecentMatchedStatus = first(intersection(prevStatus, status));
    if (!mostRecentMatchedStatus) {
      throw new ServerException(
        `The engagement ${id} has never been in any of these previous status: ${status.join(
          ', '
        )}`
      );
    }
    return mostRecentMatchedStatus;
  }

  /** A list of the engagement's previous status ordered most recent to furthest in the past */
  private async getPreviousStatus(id: ID): Promise<EngagementStatus[]> {
    const result = await this.db
      .query()
      .match([
        node('node', 'Engagement', { id }),
        relation('out', '', 'status', { active: false }),
        node('prop'),
      ])
      .with('prop')
      .orderBy('prop.createdAt', 'DESC')
      .raw(`RETURN collect(prop.value) as status`)
      .asResult<{ status: EngagementStatus[] }>()
      .first();
    if (!result) {
      throw new ServerException(
        "Failed to determine engagement's previous status"
      );
    }
    return result.status;
  }
}
