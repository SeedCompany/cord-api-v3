import { EmailService } from '@seedcompany/nestjs-email';
import {
  ConfigService,
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
  implements IEventHandler<ProjectUpdatedEvent>
{
  constructor(
    private readonly projectRules: ProjectRules,
    private readonly emailService: EmailService,
    private readonly config: ConfigService,
    @Logger('project:step-changed') private readonly logger: ILogger
  ) {}

  async handle(event: ProjectUpdatedEvent) {
    if (
      event.updated.step === event.previous.step ||
      event.updated.changeset ||
      !this.config.email.notifyProjectStepChanges
    ) {
      return;
    }

    const recipients = await this.projectRules.getNotifications(
      event.updated.id,
      event.updated.step,
      event.session.userId,
      event.previous.step
    );

    this.logger.info('Notifying', {
      emails: recipients.map((r) => r.recipient.email.value),
      projectId: event.updated.id,
      step: event.updated.step,
      previousStep: event.previous.step,
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
