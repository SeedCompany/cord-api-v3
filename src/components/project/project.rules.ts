import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { intersection } from 'lodash';
import { UnauthorizedException } from '../../common';
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
    step: ProjectStep,
    userId: string
  ) {
    // get user's roles
    const userRolesQuery = await this.db
      .query()
      .match([
        node('user', 'User', { id: userId }),
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

    // get roles that can change the current step
    const approvers = await this.getApprovers(step);

    const commonRoles = intersection(approvers, userRolesQuery.roles);

    if (commonRoles.length > 0) {
      // user is an approver for this step
      // now determine if this is a valid next step from the current one
      // get current step
      const currentStep = await this.db
        .query()
        .match([
          node('project', 'Project', { id: projectId }),
          relation('out', '', 'step', { active: true }),
          node('step', 'ProjectStep'),
        ])
        .first();
      return true;
    }
    return false;
  }

  private async getNextStepOptions() {
    //
  }

  private async getApprovers(step: ProjectStep) {
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
