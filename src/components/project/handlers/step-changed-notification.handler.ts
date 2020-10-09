import {
  EmailService,
  EventsHandler,
  IEventHandler,
  ILogger,
  Logger,
} from '../../../core';
import { ProjectStepChanged } from '../../../core/email/templates';
import { ProjectUpdatedEvent } from '../events';
import { ProjectRules } from '../project.rules';

@EventsHandler(ProjectUpdatedEvent)
export class ProjectStepChangedNotificationHandler
  implements IEventHandler<ProjectUpdatedEvent> {
  constructor(
    private readonly projectRules: ProjectRules,
    private readonly emailService: EmailService,
    @Logger('project:step-changed') private readonly logger: ILogger
  ) {}

  async handle(event: ProjectUpdatedEvent) {
    if (event.updated.step.value === event.previous.step.value) {
      return;
    }

    const recipients = await this.projectRules.getNotifications(
      event.updated.id,
      event.updated.step.value!
    );

    this.logger.info('Notifying', {
      emails: recipients.map((r) => r.recipient.email.value),
      projectId: event.updated.id,
      step: event.updated.step.value,
      previousStep: event.previous.step.value,
    });

    for (const notification of recipients) {
      if (!notification.recipient.email.value) {
        continue;
      }
      await this.emailService.send(
        notification.recipient.email.value,
        ProjectStepChanged,
        notification
      );
    }
  }
}
