import { Injectable } from '@nestjs/common';
import { type ID } from '~/common';
import { NotificationService } from '../../../notifications';
import { type ProjectStep } from '../../dto';
import { ProjectTransitionViaMembershipNotification } from './project-transition-via-membership-notification.dto';

@Injectable()
export class ProjectTransitionViaMembershipNotificationService {
  constructor(private readonly notifications: NotificationService) {}

  async notify(
    recipients: ReadonlyArray<ID<'User'>>,
    input: {
      workflowEvent: ID<'ProjectWorkflowEvent'>;
      previousStep: ProjectStep;
    },
  ) {
    await this.notifications.create(
      ProjectTransitionViaMembershipNotification,
      recipients,
      input,
    );
  }
}
