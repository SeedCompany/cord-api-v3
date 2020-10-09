/* eslint-disable no-case-declarations */
import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { intersection } from 'lodash';
import { DateTime } from 'luxon';
import { ServerException, UnauthorizedException } from '../../common';
import { DatabaseService, ILogger, Logger } from '../../core';
import { Role } from '../authorization';
import { AuthorizationService } from '../authorization/authorization.service';
import { User } from '../user';
import { Project, ProjectStep } from './dto';

class StepRule {
  approvers: Role[];
  nextSteps: ProjectStep[];
  notifications: string[]; // email addresses
}

class EmailNotification {
  user: Pick<User, 'id' | 'email' | 'realFirstName' | 'realLastName'>;
  project: Pick<Project, 'id' | 'createdAt' | 'modifiedAt' | 'name'>;
}
@Injectable()
export class ProjectRules {
  constructor(
    private readonly db: DatabaseService,
    private readonly authorizationService: AuthorizationService,
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
          nextSteps: [
            ProjectStep.PendingConceptApproval,
            ProjectStep.DidNotDevelop,
          ],
          notifications: await this.getProjectTeamEmail(id),
        };
      case ProjectStep.PendingConceptApproval:
        return {
          approvers: [Role.RegionalDirector, Role.FieldOperationsDirector],
          nextSteps: [
            ProjectStep.PrepForConsultantEndorsement,
            ProjectStep.EarlyConversations,
            ProjectStep.Rejected,
          ],
          notifications: await this.getProjectTeamEmail(id),
        };
      case ProjectStep.PrepForConsultantEndorsement:
        return {
          approvers: [
            Role.ProjectManager,
            Role.RegionalDirector,
            Role.FieldOperationsDirector,
          ],
          nextSteps: [
            ProjectStep.PendingConsultantEndorsement,
            ProjectStep.PendingConceptApproval,
            ProjectStep.DidNotDevelop,
          ],
          notifications: await this.getProjectTeamEmail(id),
        };
      case ProjectStep.PendingConsultantEndorsement:
        return {
          approvers: [Role.Consultant, Role.ConsultantManager],
          nextSteps: [ProjectStep.PrepForFinancialEndorsement],
          notifications: await this.getProjectTeamEmail(id),
        };
      case ProjectStep.PrepForFinancialEndorsement:
        return {
          approvers: [
            Role.ProjectManager,
            Role.RegionalDirector,
            Role.FieldOperationsDirector,
          ],
          nextSteps: [
            ProjectStep.PendingFinancialEndorsement,
            ProjectStep.PendingConsultantEndorsement,
            ProjectStep.PendingConceptApproval,
            ProjectStep.DidNotDevelop,
          ],
          notifications: await this.getProjectTeamEmail(id),
        };
      case ProjectStep.PendingFinancialEndorsement:
        return {
          approvers: [Role.Controller, Role.FinancialAnalyst],
          nextSteps: [ProjectStep.FinalizingProposal],
          notifications: await this.getProjectTeamEmail(id),
        };
      case ProjectStep.FinalizingProposal:
        return {
          approvers: [
            Role.ProjectManager,
            Role.RegionalDirector,
            Role.FieldOperationsDirector,
          ],
          nextSteps: [
            ProjectStep.PendingRegionalDirectorApproval,
            ProjectStep.PendingFinancialEndorsement,
            ProjectStep.PendingConsultantEndorsement,
            ProjectStep.PendingConceptApproval,
            ProjectStep.DidNotDevelop,
          ],
          notifications: await this.getProjectTeamEmail(id),
        };
      case ProjectStep.PendingRegionalDirectorApproval:
        return {
          approvers: [Role.RegionalDirector, Role.FieldOperationsDirector],
          nextSteps: [
            ProjectStep.PendingFinanceConfirmation,
            ProjectStep.PendingZoneDirectorApproval,
            ProjectStep.FinalizingProposal,
            ProjectStep.Rejected,
          ],
          notifications: await this.getProjectTeamEmail(id),
        };
      case ProjectStep.PendingZoneDirectorApproval:
        return {
          approvers: [Role.FieldOperationsDirector],
          nextSteps: [
            ProjectStep.PendingFinanceConfirmation,
            ProjectStep.FinalizingProposal,
            ProjectStep.Rejected,
          ],
          notifications: await this.getProjectTeamEmail(id),
        };
      case ProjectStep.PendingFinanceConfirmation:
        return {
          approvers: [Role.Controller],
          nextSteps: [
            ProjectStep.Active,
            ProjectStep.OnHoldFinanceConfirmation,
            ProjectStep.FinalizingProposal,
            ProjectStep.Rejected,
          ],
          notifications: [
            ...(await this.getProjectTeamEmail(id)),
            ...(await this.getRoleEmails(Role.Controller)),
          ],
        };
      case ProjectStep.OnHoldFinanceConfirmation:
        return {
          approvers: [Role.Controller],
          nextSteps: [
            ProjectStep.Active,
            ProjectStep.FinalizingProposal,
            ProjectStep.Rejected,
          ],
          notifications: [
            ...(await this.getProjectTeamEmail(id)),
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
          nextSteps: [
            ProjectStep.DiscussingChangeToPlan,
            ProjectStep.DiscussingTermination,
            ProjectStep.FinalizingCompletion,
          ],
          notifications: [
            ...(await this.getProjectTeamEmail(id)),
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
          nextSteps: [
            ProjectStep.DiscussingChangeToPlan,
            ProjectStep.DiscussingTermination,
            ProjectStep.FinalizingCompletion,
          ],
          notifications: [
            ...(await this.getProjectTeamEmail(id)),
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
          nextSteps: [
            ProjectStep.PendingChangeToPlanApproval,
            ProjectStep.DiscussingSuspension,
            ProjectStep.Active,
            ProjectStep.ActiveChangedPlan,
          ],
          notifications: [
            ...(await this.getProjectTeamEmail(id)),
            'project_extension@tsco.org',
            'project_revision@tsco.org',
          ],
        };
      case ProjectStep.PendingChangeToPlanApproval:
        return {
          approvers: [Role.RegionalDirector, Role.FieldOperationsDirector],
          nextSteps: [
            ProjectStep.DiscussingChangeToPlan,
            ProjectStep.Active,
            ProjectStep.ActiveChangedPlan,
          ],
          notifications: [
            ...(await this.getProjectTeamEmail(id)),
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
          nextSteps: [
            ProjectStep.PendingSuspensionApproval,
            ProjectStep.Active,
            ProjectStep.ActiveChangedPlan,
          ],
          notifications: [
            ...(await this.getProjectTeamEmail(id)),
            'project_suspension@tsco.org',
          ],
        };
      case ProjectStep.PendingSuspensionApproval:
        return {
          approvers: [Role.RegionalDirector, Role.FieldOperationsDirector],
          nextSteps: [
            ProjectStep.DiscussingSuspension,
            ProjectStep.Suspended,
            ProjectStep.Active,
            ProjectStep.ActiveChangedPlan,
          ],
          notifications: [
            ...(await this.getProjectTeamEmail(id)),
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
          nextSteps: [
            ProjectStep.DiscussingReactivation,
            ProjectStep.DiscussingTermination,
          ],
          notifications: [
            ...(await this.getProjectTeamEmail(id)),
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
          nextSteps: [
            ProjectStep.PendingReactivationApproval,
            ProjectStep.DiscussingTermination,
          ],
          notifications: [
            ...(await this.getProjectTeamEmail(id)),
            'project_suspension@tsco.org',
          ],
        };
      case ProjectStep.PendingReactivationApproval:
        return {
          approvers: [Role.RegionalDirector, Role.FieldOperationsDirector],
          nextSteps: [
            ProjectStep.ActiveChangedPlan,
            ProjectStep.DiscussingReactivation,
            ProjectStep.DiscussingTermination,
          ],
          notifications: [
            ...(await this.getProjectTeamEmail(id)),
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
          nextSteps: [
            ProjectStep.PendingTerminationApproval,
            ProjectStep.DiscussingReactivation,
            ProjectStep.Suspended,
            ProjectStep.Active,
          ],
          notifications: [
            ...(await this.getProjectTeamEmail(id)),
            'project_termination@tsco.org',
          ],
        };
      case ProjectStep.PendingTerminationApproval:
        return {
          approvers: [Role.RegionalDirector, Role.FieldOperationsDirector],
          nextSteps: [
            ProjectStep.Terminated,
            ProjectStep.DiscussingTermination,
            ProjectStep.DiscussingReactivation,
            ProjectStep.Suspended,
            ProjectStep.Active,
          ],
          notifications: [
            ...(await this.getProjectTeamEmail(id)),
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
          nextSteps: [
            ProjectStep.Active,
            ProjectStep.ActiveChangedPlan,
            ProjectStep.Completed,
          ],
          notifications: [
            ...(await this.getProjectTeamEmail(id)),
            'project_closing@tsco.org',
          ],
        };
      case ProjectStep.Terminated:
        return {
          approvers: [],
          nextSteps: [],
          notifications: [
            ...(await this.getProjectTeamEmail(id)),
            'project_termination@tsco.org',
          ],
        };
      case ProjectStep.Completed:
        return {
          approvers: [],
          nextSteps: [],
          notifications: [
            ...(await this.getProjectTeamEmail(id)),
            'project_closing@tsco.org',
          ],
        };
      default:
        return {
          approvers: [],
          nextSteps: [],
          notifications: [],
        };
    }
  }

  async approveStepChange(
    projectId: string,
    userId: string,
    nextStep: ProjectStep
  ) {
    // get current step
    const currentStep = await this.getCurrentStep(projectId);

    // get roles that can apporve the current step
    const approvers = (await this.getStepRule(currentStep, projectId))
      .approvers;

    // get user's roles
    const roles = await this.getUserRoles(userId);

    // find if a user has any role within the set that can approve
    const commonRoles = intersection(approvers, roles);

    if (commonRoles.length > 0) {
      // user is an approver for this step

      // determine if the requested next step is allowed
      const nextPossibleSteps = (await this.getStepRule(currentStep, projectId))
        .nextSteps;

      const validNextStep = nextPossibleSteps.includes(nextStep);

      if (!validNextStep) {
        throw new UnauthorizedException(
          'this step is not in an authorized sequence'
        );
      }

      return true;
    } else {
      // user is not an approver for this step
      throw new UnauthorizedException(
        'user is not an approver for the current step'
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
      .first();

    if (!userRolesQuery?.roles) {
      throw new UnauthorizedException(
        'user does not have the roles needed to update step'
      );
    }

    return userRolesQuery.roles;
  }

  async processStepChange(
    projectId: string,
    step: ProjectStep
  ): Promise<EmailNotification[]> {
    // notify everyone
    const emails = (await this.getStepRule(step, projectId)).notifications;

    const notifications = await Promise.all(
      emails.map((email) => this.getEmailNotificationObject(email, projectId))
    );

    this.logger.info('emailing', notifications);
    return notifications;
  }

  private async getProjectTeamEmail(id: string): Promise<string[]> {
    const emails = await this.db
      .query()
      .match([
        node('', 'Project', { id }),
        relation('out', '', 'member', { active: true }),
        node('', 'ProjectMember'),
        relation('out', '', 'user', { active: true }),
        node('', 'User'),
        relation('out', '', 'email', { active: true }),
        node('email', 'EmailAddress'),
      ])
      .raw('return collect(email.value) as emails')
      .first();
    return emails?.emails;
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
    email: string,
    projectId: string
  ): Promise<EmailNotification> {
    const project = await this.db
      .query()
      .raw(
        `
        MATCH 
          (email:EmailAddress {value: $email})
            <-[:email {active: true}]-
          (user:User)
        MATCH
          (project:Project {id: $projectId})
        MATCH
          (user)
            <-[:member]-
          (sg:SecurityGroup)
        MATCH
          (sg)
            -[:permission]->
          (:Permission {property: "modifiedAt", read: true})
            -[:baseNode]->
          (project)
            -[:modifiedAt]->
          (modifiedAtProp:Property),
          (sg)
            -[:permission]->
          (:Permission {property: "name", read: true})
            -[:baseNode]->
          (project)
            -[:name]->
          (nameProp:Property)
        RETURN
          project.id as id,
          project.createdAt as createdAt,
          modifiedAtProp.value as modifiedAt,
          nameProp.value as name
      `,
        {
          email,
          projectId,
        }
      )
      .asResult<{
        id: string;
        createdAt: DateTime;
        modifiedAt: DateTime;
        name: string;
      }>()
      .first();

    if (project === undefined) {
      throw new ServerException('error finding project');
    }

    let user = {
      id: '',
      realFirstName: email,
      realLastName: '',
    };

    this.logger.info(email);

    switch (email) {
      case 'project_extensions@tsco.org':
      case 'project_revision@tsco.org':
      case 'project_suspension@tsco.org':
      case 'project_termination@tsco.org':
      case 'project_closing@tsco.org':
        break;
      default:
        const userQuery = await this.db
          .query()
          .raw(
            `
        MATCH 
          (email:EmailAddress {value: $email})
            <-[:email {active: true}]-
          (user:User)
        MATCH
          (user)
            -[:realFirstName]->
          (realFirstNameProp:Property),
          (user)
            -[:realLastName]->
          (realLastNameProp:Property)
        RETURN
          user.id as id,
          realFirstNameProp.value as realFirstName,
          realLastNameProp.value as realLastName
    `,
            {
              email,
              projectId,
            }
          )
          .asResult<{
            id: string;
            realFirstName: string;
            realLastName: string;
          }>()
          .first();

        if (userQuery === undefined) {
          throw new ServerException('error finding user');
        }

        user = userQuery;
    }

    return {
      project: {
        id: project.id,
        createdAt: project.createdAt,
        modifiedAt: project.modifiedAt,
        name: { value: project.name, canRead: true, canEdit: false },
      },
      user: {
        id: user.id,
        email: { value: email, canRead: true, canEdit: false },
        realFirstName: {
          value: user.realFirstName,
          canRead: true,
          canEdit: false,
        },
        realLastName: {
          value: user.realLastName,
          canRead: true,
          canEdit: false,
        },
      },
    };
  }
}
