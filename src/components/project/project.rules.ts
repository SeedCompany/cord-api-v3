import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { intersection } from 'lodash';
import { ServerException, UnauthorizedException } from '../../common';
import { DatabaseService, ILogger, Logger } from '../../core';
import { Role } from '../authorization';
import { AuthorizationService } from '../authorization/authorization.service';
import { ProjectStep } from './dto';

@Injectable()
export class ProjectRules {
  constructor(
    private readonly db: DatabaseService,
    private readonly authorizationService: AuthorizationService,
    @Logger('project:rules') private readonly logger: ILogger
  ) {}

  async approveStepChange(
    projectId: string,
    userId: string,
    nextStep: ProjectStep
  ) {
    // get current step
    const currentStep = await this.getCurrentStep(projectId);

    // get roles that can apporve the current step
    const approvers = this.getApprovers(currentStep);

    // get user's roles
    const roles = await this.getUserRoles(userId);

    // find if a user has any role within the set that can approve
    const commonRoles = intersection(approvers, roles);

    if (commonRoles.length > 0) {
      // user is an approver for this step

      // determine if the requested next step is allowed
      const nextPossibleSteps = this.getNextStepOptions(currentStep);

      const validNextStep = nextPossibleSteps.includes(nextStep);

      if (!validNextStep) {
        throw new UnauthorizedException(
          'this step is not in an authorized sequence'
        );
      }

      return true;
    }

    // user is not an approver for this step
    return false;
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

  private getApprovers(step: ProjectStep): Role[] {
    switch (step) {
      case ProjectStep.EarlyConversations:
        return [
          Role.ProjectManager,
          Role.RegionalDirector,
          Role.FieldOperationsDirector,
        ];
      case ProjectStep.PendingConceptApproval:
        return [Role.RegionalDirector, Role.FieldOperationsDirector];
      case ProjectStep.PrepForConsultantEndorsement:
        return [
          Role.ProjectManager,
          Role.RegionalDirector,
          Role.FieldOperationsDirector,
        ];
      case ProjectStep.PendingConsultantEndorsement:
        return [Role.Consultant, Role.ConsultantManager];
      case ProjectStep.PrepForFinancialEndorsement:
        return [
          Role.ProjectManager,
          Role.RegionalDirector,
          Role.FieldOperationsDirector,
        ];
      case ProjectStep.PendingFinancialEndorsement:
        return [Role.Controller, Role.FinancialAnalyst];
      case ProjectStep.FinalizingProposal:
        return [
          Role.ProjectManager,
          Role.RegionalDirector,
          Role.FieldOperationsDirector,
        ];
      case ProjectStep.PendingRegionalDirectorApproval:
        return [Role.RegionalDirector, Role.FieldOperationsDirector];
      case ProjectStep.PendingZoneDirectorApproval:
        return [Role.FieldOperationsDirector];
      case ProjectStep.PendingFinanceConfirmation:
        return [Role.Controller];
      case ProjectStep.OnHoldFinanceConfirmation:
        return [Role.Controller];
      case ProjectStep.Active:
        return [
          Role.ProjectManager,
          Role.RegionalDirector,
          Role.FieldOperationsDirector,
        ];
      case ProjectStep.ActiveChangedPlan:
        return [
          Role.ProjectManager,
          Role.RegionalDirector,
          Role.FieldOperationsDirector,
        ];
      case ProjectStep.DiscussingChangeToPlan:
        return [
          Role.ProjectManager,
          Role.RegionalDirector,
          Role.FieldOperationsDirector,
        ];
      case ProjectStep.PendingChangeToPlanApproval:
        return [Role.RegionalDirector, Role.FieldOperationsDirector];
      case ProjectStep.DiscussingSuspension:
        return [
          Role.ProjectManager,
          Role.RegionalDirector,
          Role.FieldOperationsDirector,
        ];
      case ProjectStep.PendingSuspensionApproval:
        return [Role.RegionalDirector, Role.FieldOperationsDirector];
      case ProjectStep.Suspended:
        return [
          Role.ProjectManager,
          Role.RegionalDirector,
          Role.FieldOperationsDirector,
        ];
      case ProjectStep.DiscussingReactivation:
        return [
          Role.ProjectManager,
          Role.RegionalDirector,
          Role.FieldOperationsDirector,
        ];
      case ProjectStep.PendingReactivationApproval:
        return [Role.RegionalDirector, Role.FieldOperationsDirector];
      case ProjectStep.DiscussingTermination:
        return [
          Role.ProjectManager,
          Role.RegionalDirector,
          Role.FieldOperationsDirector,
        ];
      case ProjectStep.PendingTerminationApproval:
        return [Role.RegionalDirector, Role.FieldOperationsDirector];
      case ProjectStep.FinalizingCompletion:
        return [
          Role.ProjectManager,
          Role.RegionalDirector,
          Role.FieldOperationsDirector,
          Role.FinancialAnalyst,
        ];
      case ProjectStep.Terminated:
        return [];
      case ProjectStep.Completed:
        return [];
      default:
        return [];
    }
  }

  private getNextStepOptions(currentStep: ProjectStep): ProjectStep[] {
    switch (currentStep) {
      case ProjectStep.EarlyConversations:
        return [ProjectStep.PendingConceptApproval, ProjectStep.DidNotDevelop];
      case ProjectStep.PendingConceptApproval:
        return [
          ProjectStep.PrepForConsultantEndorsement,
          ProjectStep.EarlyConversations,
          ProjectStep.Rejected,
        ];
      case ProjectStep.PrepForConsultantEndorsement:
        return [
          ProjectStep.PendingConsultantEndorsement,
          ProjectStep.PendingConceptApproval,
          ProjectStep.DidNotDevelop,
        ];
      case ProjectStep.PendingConsultantEndorsement:
        return [ProjectStep.PrepForFinancialEndorsement];
      case ProjectStep.PrepForFinancialEndorsement:
        return [
          ProjectStep.PendingFinancialEndorsement,
          ProjectStep.PendingConsultantEndorsement,
          ProjectStep.PendingConceptApproval,
          ProjectStep.DidNotDevelop,
        ];
      case ProjectStep.PendingFinancialEndorsement:
        return [ProjectStep.FinalizingProposal];
      case ProjectStep.FinalizingProposal:
        return [
          ProjectStep.PendingRegionalDirectorApproval,
          ProjectStep.PendingFinancialEndorsement,
          ProjectStep.PendingConsultantEndorsement,
          ProjectStep.PendingConceptApproval,
          ProjectStep.DidNotDevelop,
        ];
      case ProjectStep.PendingRegionalDirectorApproval:
        return [
          ProjectStep.PendingFinanceConfirmation,
          ProjectStep.PendingZoneDirectorApproval,
          ProjectStep.FinalizingProposal,
          ProjectStep.Rejected,
        ];
      case ProjectStep.PendingZoneDirectorApproval:
        return [
          ProjectStep.PendingFinanceConfirmation,
          ProjectStep.FinalizingProposal,
          ProjectStep.Rejected,
        ];
      case ProjectStep.PendingFinanceConfirmation:
        return [
          ProjectStep.Active,
          ProjectStep.OnHoldFinanceConfirmation,
          ProjectStep.FinalizingProposal,
          ProjectStep.Rejected,
        ];
      case ProjectStep.OnHoldFinanceConfirmation:
        return [
          ProjectStep.Active,
          ProjectStep.FinalizingProposal,
          ProjectStep.Rejected,
        ];
      case ProjectStep.Active:
        return [
          ProjectStep.DiscussingChangeToPlan,
          ProjectStep.DiscussingTermination,
          ProjectStep.FinalizingCompletion,
        ];
      case ProjectStep.ActiveChangedPlan:
        return [
          ProjectStep.DiscussingChangeToPlan,
          ProjectStep.DiscussingTermination,
          ProjectStep.FinalizingCompletion,
        ];
      case ProjectStep.DiscussingChangeToPlan:
        return [
          ProjectStep.PendingChangeToPlanApproval,
          ProjectStep.DiscussingSuspension,
          ProjectStep.Active,
          ProjectStep.ActiveChangedPlan,
        ];
      case ProjectStep.PendingChangeToPlanApproval:
        return [
          ProjectStep.DiscussingChangeToPlan,
          ProjectStep.Active,
          ProjectStep.ActiveChangedPlan,
        ];
      case ProjectStep.DiscussingSuspension:
        return [
          ProjectStep.PendingSuspensionApproval,
          ProjectStep.Active,
          ProjectStep.ActiveChangedPlan,
        ];
      case ProjectStep.PendingSuspensionApproval:
        return [
          ProjectStep.DiscussingSuspension,
          ProjectStep.Suspended,
          ProjectStep.Active,
          ProjectStep.ActiveChangedPlan,
        ];
      case ProjectStep.Suspended:
        return [
          ProjectStep.DiscussingReactivation,
          ProjectStep.DiscussingTermination,
        ];
      case ProjectStep.DiscussingReactivation:
        return [
          ProjectStep.PendingReactivationApproval,
          ProjectStep.DiscussingTermination,
        ];
      case ProjectStep.PendingReactivationApproval:
        return [
          ProjectStep.ActiveChangedPlan,
          ProjectStep.DiscussingReactivation,
          ProjectStep.DiscussingTermination,
        ];
      case ProjectStep.DiscussingTermination:
        return [
          ProjectStep.PendingTerminationApproval,
          ProjectStep.DiscussingReactivation,
          ProjectStep.Suspended,
          ProjectStep.Active,
        ];
      case ProjectStep.PendingTerminationApproval:
        return [
          ProjectStep.Terminated,
          ProjectStep.DiscussingTermination,
          ProjectStep.DiscussingReactivation,
          ProjectStep.Suspended,
          ProjectStep.Active,
        ];
      case ProjectStep.FinalizingCompletion:
        return [
          ProjectStep.Active,
          ProjectStep.ActiveChangedPlan,
          ProjectStep.Completed,
        ];
      case ProjectStep.Terminated:
        return [];
      case ProjectStep.Completed:
        return [];
      default:
        return [];
    }
  }

  async processStepChange(
    projectId: string,
    step: ProjectStep,
    userId: string
  ) {
    // notify everyone
  }

  private async getNotifications(): Promise<string[]> {
    //
    return [];
  }
}
