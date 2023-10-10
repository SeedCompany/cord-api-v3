/* eslint-disable no-case-declarations */
import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { first, intersection, Many, uniq } from 'lodash';
import { UnreachableCaseError } from 'ts-essentials';
import { Promisable } from 'type-fest';
import {
  ID,
  maybeMany,
  ServerException,
  Session,
  UnauthorizedException,
} from '../../common';
import { ConfigService, DatabaseService, ILogger, Logger } from '../../core';
import { ACTIVE, INACTIVE } from '../../core/database/query';
import { AuthenticationService } from '../authentication';
import { Role, withoutScope } from '../authorization';
import { EngagementService, EngagementStatus } from '../engagement';
import { User, UserService } from '../user';
import {
  Project,
  ProjectStep,
  ProjectStepTransition,
  TransitionType,
} from './dto';
import { ProjectService } from './project.service';

type EmailAddress = string;

type Lazy<T> = T | (() => Promisable<T>);

type Notifier = EmailAddress | ID;

type Notifiers = Lazy<Many<Notifier>>;

interface Transition extends ProjectStepTransition {
  // Users/emails to notify when the project makes this transition
  notifiers?: Notifiers;
}

interface StepRule {
  approvers: Role[];
  transitions: Transition[];
  // Users/emails to notify when the project arrives at this step
  getNotifiers?: Notifiers;
}

export interface EmailNotification {
  recipient: Pick<
    User,
    'email' | 'displayFirstName' | 'displayLastName' | 'timezone'
  >;
  changedBy: Pick<User, 'id' | 'displayFirstName' | 'displayLastName'>;
  project: Pick<Project, 'id' | 'modifiedAt' | 'name' | 'step'>;
  previousStep?: ProjectStep;
}

const rolesThatCanBypassWorkflow: Role[] = [Role.Administrator];

@Injectable()
export class ProjectRules {
  constructor(
    private readonly db: DatabaseService,
    @Inject(forwardRef(() => UserService))
    private readonly userService: UserService & {},
    @Inject(forwardRef(() => ProjectService))
    private readonly projectService: ProjectService & {},
    @Inject(forwardRef(() => EngagementService))
    private readonly engagements: EngagementService & {},
    @Inject(forwardRef(() => AuthenticationService))
    private readonly auth: AuthenticationService & {},
    private readonly configService: ConfigService,
    // eslint-disable-next-line @seedcompany/no-unused-vars
    @Logger('project:rules') private readonly logger: ILogger,
  ) {}

  private async getStepRule(
    step: ProjectStep,
    id: ID,
    changeset?: ID,
  ): Promise<StepRule> {
    const mostRecentPreviousStep = (steps: ProjectStep[]) =>
      this.getMostRecentPreviousStep(id, steps, changeset);

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
            Role.RegionalDirector,
            Role.FieldOperationsDirector,
            Role.ProjectManager,
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
              notifiers: async () => [
                ...(await this.getRoleEmails(Role.Controller)),
                'project_approval@tsco.org',
                'projects@tsco.org',
              ],
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
              notifiers: async () => [
                ...(await this.getRoleEmails(Role.Controller)),
                'project_approval@tsco.org',
                'projects@tsco.org',
              ],
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
          getNotifiers: () => this.getProjectTeamUserIds(id),
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
            ...(await this.getRoleEmails(Role.Controller)),
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
              to: await mostRecentPreviousStep([
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
            Role.ProjectManager,
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
              to: ProjectStep.PendingChangeToPlanConfirmation,
              type: TransitionType.Approve,
              label: 'Approve Change to Plan',
            },
            {
              to: await mostRecentPreviousStep([
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
      case ProjectStep.PendingChangeToPlanConfirmation:
        return {
          approvers: [Role.Administrator, Role.Controller],
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
              to: await mostRecentPreviousStep([
                ProjectStep.Active,
                ProjectStep.ActiveChangedPlan,
              ]),
              type: TransitionType.Reject,
              label: 'Reject Change to Plan',
            },
          ],
          getNotifiers: async () => [
            ...(await this.getProjectTeamUserIds(id)),
            ...(await this.getRoleEmails(Role.Controller)),
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
              to: await mostRecentPreviousStep([
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
              to: await mostRecentPreviousStep([
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
              to: await mostRecentPreviousStep([
                ProjectStep.Active,
                ProjectStep.ActiveChangedPlan,
                ProjectStep.DiscussingReactivation,
                ProjectStep.Suspended,
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
              to: await mostRecentPreviousStep([
                ProjectStep.Active,
                ProjectStep.ActiveChangedPlan,
                ProjectStep.DiscussingReactivation,
                ProjectStep.Suspended,
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
        const disabled = await this.engagements.hasOngoing(id, [
          EngagementStatus.FinalizingCompletion,
        ]);
        return {
          approvers: [
            Role.Administrator,
            Role.Controller,
            Role.ProjectManager,
            Role.RegionalDirector,
            Role.FieldOperationsDirector,
            Role.FinancialAnalyst,
            Role.LeadFinancialAnalyst,
          ],
          transitions: [
            {
              to: await mostRecentPreviousStep([
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
              disabled,
              disabledReason: disabled
                ? 'The project cannot be completed since some engagements have a non-terminal status'
                : undefined,
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

      case ProjectStep.DidNotDevelop:
      case ProjectStep.Rejected:
        return {
          approvers: [],
          transitions: [],
          getNotifiers: () => this.getProjectTeamUserIds(id),
        };
    }
    // @ts-expect-error This code should be unreachable, to prove the exhaustiveness of switch
    throw new UnreachableCaseError(step);
  }

  async getAvailableTransitions(
    projectId: ID,
    session: Session,
    currentUserRoles?: Role[],
    changeset?: ID,
  ): Promise<ProjectStepTransition[]> {
    if (session.anonymous) {
      return [];
    }

    const currentStep = await this.getCurrentStep(projectId, changeset);

    // get roles that can approve the current step
    const { approvers, transitions } = await this.getStepRule(
      currentStep,
      projectId,
      changeset,
    );

    // If current user is not an approver (based on roles) then don't allow any transitions
    currentUserRoles ??= session.roles.map(withoutScope);
    if (intersection(approvers, currentUserRoles).length === 0) {
      return [];
    }

    return transitions;
  }

  async canBypassWorkflow(session: Session) {
    const roles = session.roles.map(withoutScope);
    return intersection(rolesThatCanBypassWorkflow, roles).length > 0;
  }

  async verifyStepChange(
    projectId: ID,
    session: Session,
    nextStep: ProjectStep,
    changeset?: ID,
  ) {
    // If current user's roles include a role that can bypass workflow
    // stop the check here.
    const currentUserRoles = session.roles.map(withoutScope);
    if (intersection(rolesThatCanBypassWorkflow, currentUserRoles).length > 0) {
      return;
    }

    const transitions = await this.getAvailableTransitions(
      projectId,
      session,
      currentUserRoles,
      changeset,
    );

    const validNextStep = transitions.some(
      (transition) => transition.to === nextStep && !transition.disabled,
    );
    if (!validNextStep) {
      throw new UnauthorizedException(
        'This step is not in an authorized sequence',
        'project.step',
      );
    }
  }

  private async getCurrentStep(id: ID, changeset?: ID) {
    let currentStep;
    if (changeset) {
      const result = await this.db
        .query()
        .match([
          node('project', 'Project', { id }),
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
          node('project', 'Project', { id }),
          relation('out', '', 'step', ACTIVE),
          node('step', 'Property'),
        ])
        .raw('return step.value as step')
        .asResult<{ step: ProjectStep }>()
        .first();
      currentStep = result?.step;
    }

    if (!currentStep) {
      throw new ServerException('current step not found');
    }

    return currentStep;
  }

  async getNotifications(
    projectId: ID,
    step: ProjectStep,
    changedById: ID,
    previousStep: ProjectStep,
    changeset?: ID,
  ): Promise<EmailNotification[]> {
    const { getNotifiers: arrivalNotifiers } = await this.getStepRule(
      step,
      projectId,
      changeset,
    );

    const transitionNotifiers = (
      await this.getStepRule(previousStep, projectId)
    ).transitions.find((t) => t.to === step)?.notifiers;

    const resolve = async (notifiers?: Notifiers) =>
      maybeMany(
        typeof notifiers === 'function' ? await notifiers() : notifiers,
      ) ?? [];

    const userIdsAndEmailAddresses = uniq([
      ...(await resolve(arrivalNotifiers)),
      ...(await resolve(transitionNotifiers)),
    ]);

    const recipientIds = this.configService.email.notifyDistributionLists
      ? userIdsAndEmailAddresses
      : userIdsAndEmailAddresses.filter(
          (idOrEmail) => !idOrEmail.includes('@'),
        );

    const notifications = await Promise.all(
      recipientIds.map((recipientId) =>
        this.getEmailNotificationObject(
          changedById,
          projectId,
          recipientId,
          previousStep,
        ),
      ),
    );

    this.logger.debug('notifying: ', notifications);

    return notifications;
  }

  private async getProjectTeamUserIds(id: ID): Promise<ID[]> {
    const users = await this.db
      .query()
      .match([
        node('', 'Project', { id }),
        relation('out', '', 'member', ACTIVE),
        node('', 'ProjectMember'),
        relation('out', '', 'user', ACTIVE),
        node('user', 'User'),
      ])
      .return<{ ids: ID[] }>('collect(user.id) as ids')
      .first();
    return users?.ids ?? [];
  }

  private async getRoleEmails(role: Role): Promise<string[]> {
    const emails = await this.db
      .query()
      .match([
        node('email', 'EmailAddress'),
        relation('in', '', 'email', ACTIVE),
        node('user', 'User'),
        relation('out', '', 'roles', ACTIVE),
        node('role', 'Property', { value: role }),
      ])
      .return<{ emails: string[] }>('collect(email.value) as emails')
      .first();

    return emails?.emails ?? [];
  }

  /** Of the given steps which one was the most recent previous step */
  private async getMostRecentPreviousStep(
    id: ID,
    steps: ProjectStep[],
    changeset?: ID,
  ): Promise<ProjectStep> {
    const prevSteps = await this.getPreviousSteps(id, changeset);
    return first(intersection(prevSteps, steps)) ?? steps[0];
  }

  /** A list of the project's previous steps ordered most recent to furthest in the past */
  private async getPreviousSteps(
    id: ID,
    changeset?: ID,
  ): Promise<ProjectStep[]> {
    const result = await this.db
      .query()
      .match([
        ...(changeset
          ? [
              node('changeset', 'Changeset', { id: changeset }),
              relation('in', '', 'changeset', ACTIVE),
            ]
          : []),
        node('node', 'Project', { id }),
        relation('out', '', 'step', changeset ? undefined : INACTIVE),
        node('prop'),
      ])
      .apply((q) =>
        changeset
          ? q.raw('WHERE NOT (changeset)-[:changeset {active:true}]->(prop)')
          : q,
      )
      .with('prop')
      .orderBy('prop.createdAt', 'DESC')
      .return<{ steps: ProjectStep[] }>(`collect(prop.value) as steps`)
      .first();
    if (!result) {
      throw new ServerException("Failed to determine project's previous steps");
    }
    return result.steps;
  }

  private async getEmailNotificationObject(
    changedById: ID,
    projectId: ID,
    notifier: Notifier,
    previousStep?: ProjectStep,
  ): Promise<EmailNotification> {
    const recipientId = notifier.includes('@')
      ? this.configService.rootAdmin.id
      : (notifier as ID);
    const recipientSession = await this.auth.sessionForUser(recipientId);
    const recipient = notifier.includes('@')
      ? {
          email: { value: notifier, canRead: true, canEdit: false },
          displayFirstName: {
            value: notifier.split('@')[0],
            canRead: true,
            canEdit: false,
          },
          displayLastName: { value: '', canRead: true, canEdit: false },
          timezone: {
            value: this.configService.defaultTimeZone,
            canRead: true,
            canEdit: false,
          },
        }
      : await this.userService.readOne(recipientId, recipientSession);

    const changedBy = await this.userService.readOne(
      changedById,
      recipientSession,
    );
    const project = await this.projectService.readOne(
      projectId,
      recipientSession,
    );

    return {
      changedBy,
      project,
      recipient,
      previousStep,
    };
  }
}
