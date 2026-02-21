import { Injectable } from '@nestjs/common';
import { type ID } from '~/common';
import { NotificationService } from '../../../notifications';
import { type ProjectStep } from '../../dto';
import { ProjectTransitionRequiringFinancialApprovalNotification } from './project-transition-requiring-financial-approval-notification.dto';

@Injectable()
export class ProjectTransitionRequiringFinancialApprovalNotificationService {
  constructor(private readonly notifications: NotificationService) {}

  async notify(
    recipients: ReadonlyArray<ID<'User'>>,
    input: {
      workflowEvent: ID<'ProjectWorkflowEvent'>;
      previousStep: ProjectStep;
    },
  ) {
    await this.notifications.create(
      ProjectTransitionRequiringFinancialApprovalNotification,
      recipients,
      input,
    );
  }
}
