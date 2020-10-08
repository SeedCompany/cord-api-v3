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
        node('step', 'ProjectStep'),
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
        return [ProjectStep.PendingConsultantEndorsement, ProjectStep];
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

  async processStepChange(
    projectId: string,
    step: ProjectStep,
    userId: string
  ) {
    //
  }

  private async getNotifications() {
    //
  }
}
