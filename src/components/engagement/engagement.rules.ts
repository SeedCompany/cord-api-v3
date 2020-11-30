/* eslint-disable no-case-declarations */
import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { first, intersection } from 'lodash';
import { ServerException, Session, UnauthorizedException } from '../../common';
import { ConfigService, DatabaseService, ILogger, Logger } from '../../core';
import { Role } from '../authorization';
import { User, UserService } from '../user';
import {
  Engagement,
  EngagementStatus,
  EngagementStatusTransition,
  EngagementTransitionType,
} from './dto';
import { EngagementService } from './engagement.service';

// TODO: Don't think we need notifiers. wiki says none for notifiers for engagment status changes
// type MaybeAsync<T> = T | Promise<T>;
// type EmailAddress = string;

interface StatusRule {
  approvers: Role[];
  transitions: EngagementStatusTransition[];
  // TODO: I don't think we'll ever need notifiers for this
  //getNotifiers: () => MaybeAsync<ReadonlyArray<EmailAddress | string>>;
}

export interface EmailNotification {
  recipient: Pick<
    User,
    'id' | 'email' | 'displayFirstName' | 'displayLastName' | 'timezone'
  >;
  changedBy: Pick<User, 'id' | 'displayFirstName' | 'displayLastName'>;
  engagement: Pick<Engagement, 'id' | 'modifiedAt' | 'status'>;
  previousStatus?: EngagementStatus;
}

@Injectable()
export class EngagementRules {
  constructor(
    private readonly db: DatabaseService,
    @Inject(forwardRef(() => UserService))
    private readonly userService: UserService,
    @Inject(forwardRef(() => EngagementService))
    private readonly engagementService: EngagementService,
    private readonly configService: ConfigService,
    // eslint-disable-next-line @seedcompany/no-unused-vars
    @Logger('engagement:rules') private readonly logger: ILogger
  ) {}

  private async getStatusRule(
    status: EngagementStatus,
    id: string
  ): Promise<StatusRule> {
    switch (status) {
      case EngagementStatus.InDevelopment:
        return {
          approvers: [Role.Administrator],
          transitions: [
            {
              to: EngagementStatus.Active,
              type: EngagementTransitionType.Approve,
              label: 'Project was made active',
            },
            {
              to: EngagementStatus.DidNotDevelop,
              type: EngagementTransitionType.Reject,
              label: 'Project did not develop',
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
              to: await this.getMostRecentPreviousStatus(id, [
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
              to: await this.getMostRecentPreviousStatus(id, [
                EngagementStatus.Active,
                EngagementStatus.ActiveChangedPlan,
              ]),
              type: EngagementTransitionType.Neutral,
              label: 'Will Not Suspend',
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
    engagementId: string,
    session: Session
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
    const currentUserRoles = await this.getUserRoles(session.userId);
    if (intersection(approvers, currentUserRoles).length === 0) {
      return [];
    }

    return transitions;
  }

  async verifyStatusChange(
    engagementId: string,
    session: Session,
    nextStatus: EngagementStatus
  ) {
    const transitions = await this.getAvailableTransitions(
      engagementId,
      session
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

  private async getCurrentStatus(id: string) {
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

  private async getUserRoles(id: string) {
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

  /** Of the given statuss which one was the most recent previous status */
  private async getMostRecentPreviousStatus(
    id: string,
    statuss: EngagementStatus[]
  ): Promise<EngagementStatus> {
    const prevStatuss = await this.getPreviousStatuss(id);
    const mostRecentMatchedStatus = first(intersection(prevStatuss, statuss));
    if (!mostRecentMatchedStatus) {
      throw new ServerException(
        `The engagement ${id} has never been in any of these previous statuss: ${statuss.join(
          ', '
        )}`
      );
    }
    return mostRecentMatchedStatus;
  }

  /** A list of the engagement's previous statuss ordered most recent to furthest in the past */
  private async getPreviousStatuss(id: string): Promise<EngagementStatus[]> {
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
