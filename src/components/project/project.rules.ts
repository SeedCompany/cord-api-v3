/* eslint-disable no-case-declarations */
import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { intersection } from 'lodash';
import { ServerException, UnauthorizedException } from '../../common';
import { DatabaseService, ILogger, Logger } from '../../core';
import { Role } from '../authorization';
import { AuthorizationService } from '../authorization/authorization.service';
import { User, UserService } from '../user';
import {
  Project,
  ProjectStep,
  ProjectStepTransition,
  TransitionType,
} from './dto';
import { ProjectService } from './project.service';

type MaybeAsync<T> = T | Promise<T>;
type EmailAddress = string;

interface StepRule {
  approvers: Role[];
  transitions: ProjectStepTransition[];
  getNotifiers: () => MaybeAsync<EmailAddress[]>;
}

export interface EmailNotification {
  recipient: Pick<
    User,
    'id' | 'email' | 'displayFirstName' | 'displayLastName' | 'timezone'
  >;
  changedBy: Pick<User, 'id' | 'displayFirstName' | 'displayLastName'>;
  project: Pick<Project, 'id' | 'modifiedAt' | 'name' | 'step'>;
  previousStep?: ProjectStep;
}

@Injectable()
export class ProjectRules {
  constructor(
    private readonly db: DatabaseService,
    private readonly authorizationService: AuthorizationService,
    private readonly userService: UserService,
    @Inject(forwardRef(() => ProjectService))
    private readonly projectService: ProjectService,
    // eslint-disable-next-line @seedcompany/no-unused-vars
    @Logger('project:rules') private readonly logger: ILogger
  ) {}

  private async getStepRule(step: ProjectStep, id: string): Promise<StepRule> {
    switch (step) {
      case ProjectStep.EarlyConversations:
        return {
          approvers: [
            Role.ProjectManager,
            Role.RegionalDirector,
            Role.FieldOperationsDirector,
          ],
          transitions: [
            {
              to: ProjectStep.PendingConceptApproval,
              type: TransitionType.Approve,
              label: 'Submit for Concept Approval',
            },
            {
              to: ProjectStep.DidNotDevelop,
              type: TransitionType.Reject,
              label: 'End Development',
            },
          ],
          getNotifiers: () => this.getProjectTeamUserIds(id),
        };
      case ProjectStep.PendingConceptApproval:
        return {
          approvers: [Role.RegionalDirector, Role.FieldOperationsDirector],
          transitions: [
            {
              to: ProjectStep.PrepForConsultantEndorsement,
              type: TransitionType.Approve,
              label: 'Approve Concept',
            },
            {
              to: ProjectStep.EarlyConversations,
              type: TransitionType.Reject,
              label: 'Send Back for Corrections',
            },
            {
              to: ProjectStep.Rejected,
              type: TransitionType.Reject,
              label: 'Reject',
            },
          ],
          getNotifiers: () => this.getProjectTeamUserIds(id),
        };
      case ProjectStep.PrepForConsultantEndorsement:
        return {
          approvers: [
            Role.ProjectManager,
            Role.RegionalDirector,
            Role.FieldOperationsDirector,
          ],
          transitions: [
            {
              to: ProjectStep.PendingConsultantEndorsement,
              type: TransitionType.Approve,
              label: 'Submit for Consultant Endorsement',
            },
            {
              to: ProjectStep.PendingConceptApproval,
              type: TransitionType.Approve,
              label: 'Resubmit for Concept Approval',
            },
            {
              to: ProjectStep.DidNotDevelop,
              type: TransitionType.Reject,
              label: 'End Development',
            },
          ],
          getNotifiers: () => this.getProjectTeamUserIds(id),
        };
      case ProjectStep.PendingConsultantEndorsement:
        return {
          approvers: [Role.Consultant, Role.ConsultantManager],
          transitions: [
            {
              to: ProjectStep.PrepForFinancialEndorsement,
              type: TransitionType.Approve,
              label: 'Endorse Plan',
            },
            {
              to: ProjectStep.PrepForFinancialEndorsement,
              type: TransitionType.Neutral,
              label: 'Do Not Endorse Plan',
            },
          ],
          getNotifiers: () => this.getProjectTeamUserIds(id),
        };
      case ProjectStep.PrepForFinancialEndorsement:
        return {
          approvers: [
            Role.ProjectManager,
            Role.RegionalDirector,
            Role.FieldOperationsDirector,
          ],
          transitions: [
            {
              to: ProjectStep.PendingFinancialEndorsement,
              type: TransitionType.Approve,
              label: 'Submit for Financial Endorsement',
            },
            {
              to: ProjectStep.PendingConsultantEndorsement,
              type: TransitionType.Neutral,
              label: 'Resubmit for Consultant Endorsement',
            },
            {
              to: ProjectStep.PendingConceptApproval,
              type: TransitionType.Neutral,
              label: 'Resubmit for Concept Approval',
            },
            {
              to: ProjectStep.DidNotDevelop,
              type: TransitionType.Reject,
              label: 'End Development',
            },
          ],
          getNotifiers: () => this.getProjectTeamUserIds(id),
        };
      case ProjectStep.PendingFinancialEndorsement:
        return {
          approvers: [Role.Controller, Role.FinancialAnalyst],
          transitions: [
            {
              to: ProjectStep.FinalizingProposal,
              type: TransitionType.Approve,
              label: 'Endorse Project Plan',
            },
            {
              to: ProjectStep.FinalizingProposal,
              type: TransitionType.Neutral,
              label: 'Do Not Endorse Project Plan',
            },
          ],
          getNotifiers: () => this.getProjectTeamUserIds(id),
        };
      case ProjectStep.FinalizingProposal:
        return {
          approvers: [
            Role.ProjectManager,
            Role.RegionalDirector,
            Role.FieldOperationsDirector,
          ],
          transitions: [
            {
              to: ProjectStep.PendingRegionalDirectorApproval,
              type: TransitionType.Approve,
              label: 'Submit for Approval',
            },
            {
              to: ProjectStep.PendingFinancialEndorsement,
              type: TransitionType.Neutral,
              label: 'Resubmit for Financial Endorsement',
            },
            {
              to: ProjectStep.PendingConsultantEndorsement,
              type: TransitionType.Neutral,
              label: 'Resubmit for Consultant Endorsement',
            },
            {
              to: ProjectStep.PendingConceptApproval,
              type: TransitionType.Neutral,
              label: 'Resubmit for Concept Approval',
            },
            {
              to: ProjectStep.DidNotDevelop,
              type: TransitionType.Reject,
              label: 'End Development',
            },
          ],
          getNotifiers: () => this.getProjectTeamUserIds(id),
        };
      case ProjectStep.PendingRegionalDirectorApproval:
        return {
          approvers: [Role.RegionalDirector, Role.FieldOperationsDirector],
          transitions: [
            {
              to: ProjectStep.PendingFinanceConfirmation,
              type: TransitionType.Approve,
              label: 'Approve Project',
            },
            {
              to: ProjectStep.PendingZoneDirectorApproval,
              type: TransitionType.Approve,
              label: 'Approve for Zonal Director Review',
            },
            {
              to: ProjectStep.FinalizingProposal,
              type: TransitionType.Reject,
              label: 'Send Back for Corrections',
            },
            {
              to: ProjectStep.Rejected,
              type: TransitionType.Reject,
              label: 'Reject',
            },
          ],
          getNotifiers: () => this.getProjectTeamUserIds(id),
        };
      case ProjectStep.PendingZoneDirectorApproval:
        return {
          approvers: [Role.FieldOperationsDirector],
          transitions: [
            {
              to: ProjectStep.PendingFinanceConfirmation,
              type: TransitionType.Approve,
              label: 'Approve Project',
            },
            {
              to: ProjectStep.FinalizingProposal,
              type: TransitionType.Reject,
              label: 'Send Back for Corrections',
            },
            {
              to: ProjectStep.Rejected,
              type: TransitionType.Reject,
              label: 'Reject',
            },
          ],
          getNotifiers: () => this.getProjectTeamUserIds(id),
        };
      case ProjectStep.PendingFinanceConfirmation:
        return {
          approvers: [Role.Controller],
          transitions: [
            {
              to: ProjectStep.Active,
              type: TransitionType.Approve,
              label: 'Confirm Project 🎉',
            },
            {
              to: ProjectStep.OnHoldFinanceConfirmation,
              type: TransitionType.Neutral,
              label: 'Hold Project for Confirmation',
            },
            {
              to: ProjectStep.FinalizingProposal,
              type: TransitionType.Reject,
              label: 'Send Back for Corrections',
            },
            {
              to: ProjectStep.Rejected,
              type: TransitionType.Reject,
              label: 'Reject',
            },
          ],
          getNotifiers: async () => [
            ...(await this.getProjectTeamUserIds(id)),
            ...(await this.getRoleEmails(Role.Controller)),
          ],
        };
      case ProjectStep.OnHoldFinanceConfirmation:
        return {
          approvers: [Role.Controller],
          transitions: [
            {
              to: ProjectStep.Active,
              type: TransitionType.Approve,
              label: 'Confirm Project 🎉',
            },
            {
              to: ProjectStep.FinalizingProposal,
              type: TransitionType.Reject,
              label: 'Send Back for Corrections',
            },
            {
              to: ProjectStep.Rejected,
              type: TransitionType.Reject,
              label: 'Reject',
            },
          ],
          getNotifiers: async () => [
            ...(await this.getProjectTeamUserIds(id)),
            ...(await this.getRoleEmails(Role.Controller)),
          ],
        };
      case ProjectStep.Active:
        return {
          approvers: [
            Role.ProjectManager,
            Role.RegionalDirector,
            Role.FieldOperationsDirector,
          ],
          transitions: [
            {
              to: ProjectStep.DiscussingChangeToPlan,
              type: TransitionType.Neutral,
              label: 'Discuss Change to Plan',
            },
            {
              to: ProjectStep.DiscussingTermination,
              type: TransitionType.Neutral,
              label: 'Discuss Termination',
            },
            {
              to: ProjectStep.FinalizingCompletion,
              type: TransitionType.Approve,
              label: 'Finalize Completion',
            },
          ],
          getNotifiers: async () => [
            ...(await this.getProjectTeamUserIds(id)),
            ...(await this.getRoleEmails(Role.Controller)),
            'project_approve@tsco.org',
          ],
        };
      case ProjectStep.ActiveChangedPlan:
        return {
          approvers: [
            Role.ProjectManager,
            Role.RegionalDirector,
            Role.FieldOperationsDirector,
          ],
          transitions: [
            {
              to: ProjectStep.DiscussingChangeToPlan,
              type: TransitionType.Neutral,
              label: 'Discuss Change to Plan',
            },
            {
              to: ProjectStep.DiscussingTermination,
              type: TransitionType.Neutral,
              label: 'Discuss Termination',
            },
            {
              to: ProjectStep.FinalizingCompletion,
              type: TransitionType.Approve,
              label: 'Finalize Completion',
            },
          ],
          getNotifiers: async () => [
            ...(await this.getProjectTeamUserIds(id)),
            'project_extension@tsco.org',
            'project_revision@tsco.org',
          ],
        };
      case ProjectStep.DiscussingChangeToPlan:
        return {
          approvers: [
            Role.ProjectManager,
            Role.RegionalDirector,
            Role.FieldOperationsDirector,
          ],
          transitions: [
            {
              to: ProjectStep.PendingChangeToPlanApproval,
              type: TransitionType.Approve,
              label: 'Submit for Approval',
            },
            {
              to: ProjectStep.DiscussingSuspension,
              type: TransitionType.Neutral,
              label: 'Discuss Suspension',
            },
            // TODO Dedup these next two. It should be based on whether the project had previously completed changed plan or not.
            {
              to: ProjectStep.Active,
              type: TransitionType.Neutral,
              label: 'Will Not Change Plan',
            },
            {
              to: ProjectStep.ActiveChangedPlan,
              type: TransitionType.Neutral,
              label: 'Will Not Change Plan',
            },
          ],
          getNotifiers: async () => [
            ...(await this.getProjectTeamUserIds(id)),
            'project_extension@tsco.org',
            'project_revision@tsco.org',
          ],
        };
      case ProjectStep.PendingChangeToPlanApproval:
        return {
          approvers: [Role.RegionalDirector, Role.FieldOperationsDirector],
          transitions: [
            {
              to: ProjectStep.DiscussingChangeToPlan,
              type: TransitionType.Reject,
              label: 'Send Back for Corrections',
            },
            {
              to: ProjectStep.ActiveChangedPlan,
              type: TransitionType.Approve,
              label: 'Approve Change to Plan',
            },
            {
              to: ProjectStep.Active, // TODO I think this should be back to ActiveChangedPlan if the project successfully changed plan previously
              type: TransitionType.Reject,
              label: 'Reject Change to Plan',
            },
          ],
          getNotifiers: async () => [
            ...(await this.getProjectTeamUserIds(id)),
            'project_extension@tsco.org',
            'project_revision@tsco.org',
          ],
        };
      case ProjectStep.DiscussingSuspension:
        return {
          approvers: [
            Role.ProjectManager,
            Role.RegionalDirector,
            Role.FieldOperationsDirector,
          ],
          transitions: [
            {
              to: ProjectStep.PendingSuspensionApproval,
              type: TransitionType.Neutral,
              label: 'Submit for Approval',
            },
            // TODO dedup
            {
              to: ProjectStep.Active,
              type: TransitionType.Neutral,
              label: 'Will Not Suspend',
            },
            {
              to: ProjectStep.ActiveChangedPlan,
              type: TransitionType.Neutral,
              label: 'Will Not Suspend',
            },
          ],
          getNotifiers: async () => [
            ...(await this.getProjectTeamUserIds(id)),
            'project_suspension@tsco.org',
          ],
        };
      case ProjectStep.PendingSuspensionApproval:
        return {
          approvers: [Role.RegionalDirector, Role.FieldOperationsDirector],
          transitions: [
            {
              to: ProjectStep.DiscussingSuspension,
              type: TransitionType.Reject,
              label: 'Send Back for Corrections',
            },
            {
              to: ProjectStep.Suspended,
              type: TransitionType.Approve,
              label: 'Approve Suspension',
            },
            // TODO dedup
            {
              to: ProjectStep.Active,
              type: TransitionType.Reject,
              label: 'Reject Suspension',
            },
            {
              to: ProjectStep.ActiveChangedPlan,
              type: TransitionType.Reject,
              label: 'Reject Suspension',
            },
          ],
          getNotifiers: async () => [
            ...(await this.getProjectTeamUserIds(id)),
            'project_suspension@tsco.org',
          ],
        };
      case ProjectStep.Suspended:
        return {
          approvers: [
            Role.ProjectManager,
            Role.RegionalDirector,
            Role.FieldOperationsDirector,
          ],
          transitions: [
            {
              to: ProjectStep.DiscussingReactivation,
              type: TransitionType.Neutral,
              label: 'Discuss Reactivation',
            },
            {
              to: ProjectStep.DiscussingTermination,
              type: TransitionType.Neutral,
              label: 'Discuss Termination',
            },
          ],
          getNotifiers: async () => [
            ...(await this.getProjectTeamUserIds(id)),
            'project_suspension@tsco.org',
          ],
        };
      case ProjectStep.DiscussingReactivation:
        return {
          approvers: [
            Role.ProjectManager,
            Role.RegionalDirector,
            Role.FieldOperationsDirector,
          ],
          transitions: [
            {
              to: ProjectStep.PendingReactivationApproval,
              type: TransitionType.Approve,
              label: 'Submit for Approval',
            },
            {
              to: ProjectStep.DiscussingTermination,
              type: TransitionType.Neutral,
              label: 'Discuss Termination',
            },
          ],
          getNotifiers: async () => [
            ...(await this.getProjectTeamUserIds(id)),
            'project_suspension@tsco.org',
          ],
        };
      case ProjectStep.PendingReactivationApproval:
        return {
          approvers: [Role.RegionalDirector, Role.FieldOperationsDirector],
          transitions: [
            {
              to: ProjectStep.ActiveChangedPlan,
              type: TransitionType.Approve,
              label: 'Approve Reactivation',
            },
            {
              to: ProjectStep.DiscussingReactivation,
              type: TransitionType.Reject,
              label: 'Send Back for Corrections',
            },
            {
              to: ProjectStep.DiscussingTermination,
              type: TransitionType.Neutral,
              label: 'Discuss Termination',
            },
          ],
          getNotifiers: async () => [
            ...(await this.getProjectTeamUserIds(id)),
            'project_suspension@tsco.org',
          ],
        };
      case ProjectStep.DiscussingTermination:
        return {
          approvers: [
            Role.ProjectManager,
            Role.RegionalDirector,
            Role.FieldOperationsDirector,
          ],
          transitions: [
            {
              to: ProjectStep.PendingTerminationApproval,
              type: TransitionType.Approve,
              label: 'Submit for Approval',
            },
            // TODO dedup
            {
              to: ProjectStep.DiscussingReactivation,
              type: TransitionType.Neutral,
              label: 'Will Not Terminate',
            },
            {
              to: ProjectStep.Suspended,
              type: TransitionType.Neutral,
              label: 'Will Not Terminate',
            },
            {
              to: ProjectStep.Active,
              type: TransitionType.Neutral,
              label: 'Will Not Terminate',
            },
          ],
          getNotifiers: async () => [
            ...(await this.getProjectTeamUserIds(id)),
            'project_termination@tsco.org',
          ],
        };
      case ProjectStep.PendingTerminationApproval:
        return {
          approvers: [Role.RegionalDirector, Role.FieldOperationsDirector],
          transitions: [
            {
              to: ProjectStep.Terminated,
              type: TransitionType.Approve,
              label: 'Approve Termination',
            },
            {
              to: ProjectStep.DiscussingTermination,
              type: TransitionType.Reject,
              label: 'Send Back for Corrections',
            },
            // TODO Dedup
            {
              to: ProjectStep.DiscussingReactivation,
              type: TransitionType.Neutral,
              label: 'Will Not Terminate',
            },
            {
              to: ProjectStep.Suspended,
              type: TransitionType.Neutral,
              label: 'Will Not Terminate',
            },
            {
              to: ProjectStep.Active,
              type: TransitionType.Neutral,
              label: 'Will Not Terminate',
            },
          ],
          getNotifiers: async () => [
            ...(await this.getProjectTeamUserIds(id)),
            'project_termination@tsco.org',
          ],
        };
      case ProjectStep.FinalizingCompletion:
        return {
          approvers: [
            Role.ProjectManager,
            Role.RegionalDirector,
            Role.FieldOperationsDirector,
            Role.FinancialAnalyst,
          ],
          transitions: [
            // TODO Dedup
            {
              to: ProjectStep.Active,
              type: TransitionType.Neutral,
              label: 'Still Working',
            },
            {
              to: ProjectStep.ActiveChangedPlan,
              type: TransitionType.Neutral,
              label: 'Still Working',
            },
            {
              to: ProjectStep.Completed,
              type: TransitionType.Approve,
              label: 'Complete 🎉',
            },
          ],
          getNotifiers: async () => [
            ...(await this.getProjectTeamUserIds(id)),
            'project_closing@tsco.org',
          ],
        };
      case ProjectStep.Terminated:
        return {
          approvers: [],
          transitions: [],
          getNotifiers: async () => [
            ...(await this.getProjectTeamUserIds(id)),
            'project_termination@tsco.org',
          ],
        };
      case ProjectStep.Completed:
        return {
          approvers: [],
          transitions: [],
          getNotifiers: async () => [
            ...(await this.getProjectTeamUserIds(id)),
            'project_closing@tsco.org',
          ],
        };
      default:
        return {
          approvers: [],
          transitions: [],
          getNotifiers: () => [],
        };
    }
  }

  async getAvailableTransitions(
    projectId: string,
    userId?: string
  ): Promise<ProjectStepTransition[]> {
    const currentStep = await this.getCurrentStep(projectId);

    // get roles that can approve the current step
    const { approvers, transitions } = await this.getStepRule(
      currentStep,
      projectId
    );

    // If current user is not an approver (based on roles) then don't allow any transitions
    const currentUserRoles = await this.getUserRoles(userId);
    if (intersection(approvers, currentUserRoles).length === 0) {
      return [];
    }

    return transitions;
  }

  async verifyStepChange(
    projectId: string,
    userId: string | undefined,
    nextStep: ProjectStep
  ) {
    console.log(projectId, nextStep);
    const transitions = await this.getAvailableTransitions(projectId, userId);

    const validNextStep = transitions.some(
      (transition) => transition.to === nextStep
    );
    if (!validNextStep) {
      throw new UnauthorizedException(
        'This step is not in an authorized sequence',
        'project.step'
      );
    }
  }

  private async getCurrentStep(id: string) {
    const currentStep = await this.db
      .query()
      .match([
        node('project', 'Project', { id }),
        relation('out', '', 'step', { active: true }),
        node('step', 'Property'),
      ])
      .raw('return step.value as step')
      .asResult<{ step: ProjectStep }>()
      .first();

    if (!currentStep?.step) {
      throw new ServerException('current step not found');
    }

    return currentStep.step;
  }

  private async getUserRoles(id?: string) {
    if (!id) {
      return [];
    }

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

  async getNotifications(
    projectId: string,
    step: ProjectStep,
    changedById: string,
    previousStep?: ProjectStep
  ): Promise<EmailNotification[]> {
    // notify everyone
    const { getNotifiers } = await this.getStepRule(step, projectId);
    const userIds = await getNotifiers();

    const notifications = await Promise.all(
      userIds.map((recipientId) =>
        this.getEmailNotificationObject(
          changedById,
          projectId,
          recipientId,
          previousStep
        )
      )
    );

    this.logger.info('notifying: ', notifications);

    return notifications;
  }

  private async getProjectTeamUserIds(id: string): Promise<string[]> {
    const users = await this.db
      .query()
      .match([
        node('', 'Project', { id }),
        relation('out', '', 'member', { active: true }),
        node('', 'ProjectMember'),
        relation('out', '', 'user', { active: true }),
        node('user', 'User'),
      ])
      .raw('return collect(user.id) as ids')
      .first();
    return users?.ids;
  }

  private async getRoleEmails(role: Role): Promise<string[]> {
    const emails = await this.db
      .query()
      .match([
        node('email', 'EmailAddress'),
        relation('in', '', 'email', { active: true }),
        node('user', 'User'),
        relation('out', '', 'roles', { active: true, role }),
        node('role', 'Property'),
      ])
      .raw('return collect(email.value) as emails')
      .first();

    return emails?.emails;
  }

  private async getEmailNotificationObject(
    changedById: string,
    projectId: string,
    recipientId: string,
    previousStep?: ProjectStep
  ): Promise<EmailNotification> {
    return {
      changedBy: await this.userService.readOne(changedById, {
        userId: recipientId,
      }),
      project: await this.projectService.readOne(projectId, {
        userId: recipientId,
      }),
      recipient: await this.userService.readOne(recipientId, {
        userId: recipientId,
      }),
      previousStep,
    };
  }
}
