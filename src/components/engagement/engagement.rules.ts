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
import { ProjectStep } from '../project';
import {
  EngagementStatus,
  EngagementStatusTransition,
  EngagementTransitionType,
} from './dto';

interface StatusRule {
  approvers: Role[];
  transitions: EngagementStatusTransition[];
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
              label: 'Project was made active',
              projectStepRequirements: [ProjectStep.Active],
            },
            {
              to: EngagementStatus.DidNotDevelop,
              type: EngagementTransitionType.Reject,
              label: 'Project did not develop',
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
              projectStepRequirements: [ProjectStep.Active],
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
              projectStepRequirements: [ProjectStep.Active],
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
              projectStepRequirements: [],
            },
            {
              to: EngagementStatus.DiscussingTermination,
              type: EngagementTransitionType.Neutral,
              label: 'Discuss Termination',
              projectStepRequirements: [],
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
              projectStepRequirements: [],
            },
            {
              to: EngagementStatus.DiscussingTermination,
              type: EngagementTransitionType.Neutral,
              label: 'Discuss Termination',
              projectStepRequirements: [],
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
              projectStepRequirements: [],
            },
            {
              to: EngagementStatus.Terminated,
              type: EngagementTransitionType.Approve,
              label: 'Approve Termination',
              projectStepRequirements: [],
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
              projectStepRequirements: [],
            },
            {
              to: EngagementStatus.Completed,
              type: EngagementTransitionType.Approve,
              label: 'Complete 🎉',
              projectStepRequirements: [],
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
    currentUserRoles?: Role[]
  ): Promise<EngagementStatusTransition[]> {
    if (session.anonymous) {
      return [];
    }

    const currentStatus = await this.getCurrentStatus(engagementId);
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
        (transition) => transition.projectStepRequirements.length > 0
      )
    ) {
      return transitions;
    }

    const currentStep = await this.getCurrentProjectStep(engagementId);
    const availableTransitionsAccordingToProject = transitions.filter(
      (transition) =>
        transition.projectStepRequirements.length === 0 ||
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
    nextStatus: EngagementStatus
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
      currentUserRoles
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

  private async getCurrentStatus(id: ID) {
    const currentStatus = await this.db
      .query()
      .match([
        node('engagement', 'Engagement', { id }),
        relation('out', '', 'status', { active: true }),
        node('status', 'Property'),
      ])
      .raw('return status.value as status')
      .asResult<{ status: EngagementStatus }>()
      .first();

    if (!currentStatus?.status) {
      throw new ServerException('current status not found');
    }

    return currentStatus.status;
  }

  private async getCurrentProjectStep(engagementId: ID) {
    const result = await this.db
      .query()
      .match([
        node('engagement', 'Engagement', { id: engagementId }),
        relation('in', '', 'engagement', { active: true }),
        node('project', 'Project'),
        relation('out', '', 'step', { active: true }),
        node('step', 'Property'),
      ])
      .raw('return step.value as step')
      .asResult<{ step: ProjectStep }>()
      .first();

    if (!result?.step) {
      throw new ServerException(`Could not find project's step`);
    }

    return result.step;
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
        node('prop', 'Property'),
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
