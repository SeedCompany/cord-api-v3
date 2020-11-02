/* eslint-disable no-case-declarations */
import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { first, intersection } from 'lodash';
import { ServerException, Session, UnauthorizedException } from '../../common';
import { ConfigService, DatabaseService, ILogger, Logger } from '../../core';
import { Role } from '../authorization';
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
    private readonly userService: UserService,
    @Inject(forwardRef(() => ProjectService))
    private readonly projectService: ProjectService,
    private readonly configService: ConfigService,
    // eslint-disable-next-line @seedcompany/no-unused-vars
    @Logger('project:rules') private readonly logger: ILogger
  ) {}

  private async getStepRule(step: ProjectStep, id: string): Promise<StepRule> {
    switch (step) {
      case ProjectStep.EarlyConversations:
        return {
          approvers: [
            Role.Administrator,
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
          approvers: [
            Role.Administrator,
            Role.RegionalDirector,
            Role.FieldOperationsDirector,
          ],
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
            Role.Administrator,
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
      case ProjectStep.PendingConsultantEndorsement:
        return {
          approvers: [
            Role.Administrator,
            Role.Consultant,
            Role.ConsultantManager,
          ],
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
            Role.Administrator,
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
          approvers: [
            Role.Administrator,
            Role.Controller,
            Role.FinancialAnalyst,
          ],
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
            Role.Administrator,
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
          approvers: [
            Role.Administrator,
            Role.RegionalDirector,
            Role.FieldOperationsDirector,
          ],
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
          approvers: [Role.Administrator, Role.FieldOperationsDirector],
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
          approvers: [Role.Administrator, Role.Controller],
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
          approvers: [Role.Administrator, Role.Controller],
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
            Role.Administrator,
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
            Role.Administrator,
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
            Role.Administrator,
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
            {
              to: await this.getMostRecentPreviousStep(id, [
                ProjectStep.Active,
                ProjectStep.ActiveChangedPlan,
              ]),
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
          approvers: [
            Role.Administrator,
            Role.RegionalDirector,
            Role.FieldOperationsDirector,
          ],
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
              to: await this.getMostRecentPreviousStep(id, [
                ProjectStep.Active,
                ProjectStep.ActiveChangedPlan,
              ]),
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
            Role.Administrator,
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
            {
              to: await this.getMostRecentPreviousStep(id, [
                ProjectStep.Active,
                ProjectStep.ActiveChangedPlan,
              ]),
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
          approvers: [
            Role.Administrator,
            Role.RegionalDirector,
            Role.FieldOperationsDirector,
          ],
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
            {
              to: await this.getMostRecentPreviousStep(id, [
                ProjectStep.Active,
                ProjectStep.ActiveChangedPlan,
              ]),
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
            Role.Administrator,
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
            Role.Administrator,
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
          approvers: [
            Role.Administrator,
            Role.RegionalDirector,
            Role.FieldOperationsDirector,
          ],
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
            Role.Administrator,
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
            {
              to: await this.getMostRecentPreviousStep(id, [
                ProjectStep.DiscussingReactivation,
                ProjectStep.Suspended,
                ProjectStep.Active,
                ProjectStep.ActiveChangedPlan,
              ]),
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
          approvers: [
            Role.Administrator,
            Role.RegionalDirector,
            Role.FieldOperationsDirector,
          ],
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
            {
              to: await this.getMostRecentPreviousStep(id, [
                ProjectStep.DiscussingReactivation,
                ProjectStep.Suspended,
                ProjectStep.Active,
                ProjectStep.ActiveChangedPlan,
              ]),
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
            Role.Administrator,
            Role.ProjectManager,
            Role.RegionalDirector,
            Role.FieldOperationsDirector,
            Role.FinancialAnalyst,
          ],
          transitions: [
            {
              to: await this.getMostRecentPreviousStep(id, [
                ProjectStep.Active,
                ProjectStep.ActiveChangedPlan,
              ]),
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
          approvers: [Role.Administrator],
          transitions: [],
          getNotifiers: async () => [
            ...(await this.getProjectTeamUserIds(id)),
            'project_termination@tsco.org',
          ],
        };
      case ProjectStep.Completed:
        return {
          approvers: [Role.Administrator],
          transitions: [],
          getNotifiers: async () => [
            ...(await this.getProjectTeamUserIds(id)),
            'project_closing@tsco.org',
          ],
        };
      default:
        return {
          approvers: [Role.Administrator],
          transitions: [],
          getNotifiers: () => [],
        };
    }
  }

  async getAvailableTransitions(
    projectId: string,
    session: Session
  ): Promise<ProjectStepTransition[]> {
    if (session.anonymous) {
      return [];
    }

    const currentStep = await this.getCurrentStep(projectId);

    // get roles that can approve the current step
    const { approvers, transitions } = await this.getStepRule(
      currentStep,
      projectId
    );

    // If current user is not an approver (based on roles) then don't allow any transitions
    const currentUserRoles = await this.getUserRoles(session.userId);
    if (intersection(approvers, currentUserRoles).length === 0) {
      return [];
    }

    return transitions;
  }

  async verifyStepChange(
    projectId: string,
    session: Session,
    nextStep: ProjectStep
  ) {
    const transitions = await this.getAvailableTransitions(projectId, session);

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

  /** Of the given steps which one was the most recent previous step */
  private async getMostRecentPreviousStep(
    id: string,
    steps: ProjectStep[]
  ): Promise<ProjectStep> {
    const prevSteps = await this.getPreviousSteps(id);
    const mostRecentMatchedStep = first(intersection(prevSteps, steps));
    if (!mostRecentMatchedStep) {
      throw new ServerException(
        `The project ${id} has never been in any of these previous steps: ${steps.join(
          ', '
        )}`
      );
    }
    return mostRecentMatchedStep;
  }

  /** A list of the project's previous steps ordered most recent to furthest in the past */
  private async getPreviousSteps(id: string): Promise<ProjectStep[]> {
    const result = await this.db
      .query()
      .match([
        node('node', 'Project', { id }),
        relation('out', '', 'step', { active: false }),
        node('prop', 'Property'),
      ])
      .return('prop.value as steps')
      .orderBy('prop.createdAt', 'DESC')
      .asResult<{ steps: ProjectStep[] }>()
      .first();
    if (!result) {
      throw new ServerException("Failed to determine project's previous steps");
    }
    return result.steps;
  }

  private async getEmailNotificationObject(
    changedById: string,
    projectId: string,
    recipientId: string,
    previousStep?: ProjectStep
  ): Promise<EmailNotification> {
    let recipient;
    let changedBy;
    let project;

    if (recipientId.includes('@')) {
      changedBy = await this.userService.readOne(changedById, {
        userId: this.configService.rootAdmin.id,
      });
      project = await this.projectService.readOne(projectId, {
        userId: this.configService.rootAdmin.id,
      });
      recipient = {
        id: recipientId.split('@')[0],
        email: { value: recipientId, canRead: true, canEdit: false },
        displayFirstName: {
          value: recipientId.split('@')[0],
          canRead: true,
          canEdit: false,
        },
        displayLastName: { value: '', canRead: true, canEdit: false },
        timezone: {
          value: this.configService.defaultTimeZone,
          canRead: true,
          canEdit: false,
        },
      };
    } else {
      changedBy = await this.userService.readOne(changedById, {
        userId: recipientId,
      });
      project = await this.projectService.readOne(projectId, {
        userId: recipientId,
      });
      recipient = await this.userService.readOne(recipientId, {
        userId: recipientId,
      });
    }
    return {
      changedBy,
      project,
      recipient,
      previousStep,
    };
  }
}
