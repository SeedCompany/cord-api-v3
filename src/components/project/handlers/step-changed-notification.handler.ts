import { EmailService, EventsHandler, IEventHandler } from '../../../core';
import { ProjectStepChanged } from '../../../core/email/templates';
import { UserService } from '../../user';
import { ProjectUpdatedEvent } from '../events';

@EventsHandler(ProjectUpdatedEvent)
export class ProjectStepChangedNotificationHandler
  implements IEventHandler<ProjectUpdatedEvent> {
  constructor(
    private readonly users: UserService,
    private readonly emailService: EmailService
  ) {}

  async handle(event: ProjectUpdatedEvent) {
    if (event.updated.step.value === event.previous.step.value) {
      return;
    }

    const changedBy = await this.users.readOne(
      event.session.userId!,
      event.session
    );

    const recipients = await this.determineRecipients(event);

    for (const recipient of recipients) {
      await this.emailService.send(recipient, ProjectStepChanged, {
        // TODO objects should permission-ed based on the recipient, not the current user.
        project: event.updated,
        oldStep: event.previous.step.value,
        changedBy,
        changedAt: event.updated.modifiedAt,
      });
    }
  }

  private async determineRecipients(
    event: ProjectUpdatedEvent
  ): Promise<string[]> {
    const users = [
      // TODO Connect up.
      // Just the changer for now
      await this.users.readOne(event.session.userId!, event.session),
    ];

    // TODO need to fetch email addresses regardless of current users permissions
    return users.map((user) => user.email.value!);
  }
}
