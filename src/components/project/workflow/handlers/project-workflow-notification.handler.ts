import { ModuleRef } from '@nestjs/core';
import { asyncPool } from '@seedcompany/common';
import { EmailService } from '@seedcompany/nestjs-email';
import { type UnsecuredDto } from '~/common';
import {
  ConfigService,
  EventsHandler,
  type IEventHandler,
  ILogger,
  Logger,
} from '~/core';
import {
  ProjectStepChanged,
  type ProjectStepChangedProps,
} from '~/core/email/templates/project-step-changed.template';
import { AuthenticationService } from '../../../authentication';
import { ProjectService } from '../../../project';
import { UserService } from '../../../user';
import { type User } from '../../../user/dto';
import { type Notifier } from '../../../workflow/transitions/notifiers';
import { type Project, type ProjectStep } from '../../dto';
import { ProjectTransitionedEvent } from '../events/project-transitioned.event';

@EventsHandler(ProjectTransitionedEvent)
export class ProjectWorkflowNotificationHandler
  implements IEventHandler<ProjectTransitionedEvent>
{
  constructor(
    private readonly auth: AuthenticationService,
    private readonly config: ConfigService,
    private readonly users: UserService,
    private readonly projects: ProjectService,
    private readonly emailService: EmailService,
    private readonly moduleRef: ModuleRef,
    @Logger('progress-report:status-change-notifier')
    private readonly logger: ILogger,
  ) {}

  async handle(event: ProjectTransitionedEvent) {
    const { previousStep, next, workflowEvent, session } = event;
    const transition = typeof next !== 'string' ? next : undefined;

    // TODO on bypass: keep notifying members? add anyone else?
    const notifiers = transition?.notifiers ?? [];

    const params = {
      project: event.project,
      previousStep,
      moduleRef: this.moduleRef,
    };
    const notifyees = (
      await Promise.all(notifiers.map((notifier) => notifier.resolve(params)))
    )
      .flat()
      .filter(
        (n) =>
          // Not current user
          n.id !== session.userId &&
          // Only email notifications right now
          n.email,
      );

    if (notifyees.length === 0) {
      return;
    }

    this.logger.info('Notifying', {
      emails: notifyees.flatMap((r) => r.email ?? []),
      projectId: event.project.id,
      previousStep: event.previousStep,
      toStep: event.workflowEvent.to,
    });

    const [changedBy, project, primaryPartnerName] = await Promise.all([
      this.users.readOneUnsecured(
        workflowEvent.who.id,
        this.config.rootUser.id,
      ),
      this.projects.readOneUnsecured(event.project.id, this.config.rootUser.id),
      this.projects.getPrimaryOrganizationName(event.project.id),
    ]);

    await asyncPool(1, notifyees, async (notifier) => {
      if (!notifier.email) {
        return;
      }

      const props = await this.resolveTemplateProps(
        notifier,
        changedBy,
        project,
        previousStep,
        primaryPartnerName,
      );
      await this.emailService.send(notifier.email, ProjectStepChanged, props);
    });
  }

  private async resolveTemplateProps(
    notifier: Notifier,
    changedBy: UnsecuredDto<User>,
    project: UnsecuredDto<Project>,
    previousStep: ProjectStep,
    primaryPartnerName: string | null,
  ): Promise<ProjectStepChangedProps> {
    const recipientId = notifier.id ?? this.config.rootUser.id;
    const recipientSession = await this.auth.sessionForUser(recipientId);
    const recipient = notifier.id
      ? await this.users.readOne(recipientId, recipientSession)
      : ({
          email: { value: notifier.email, canRead: true, canEdit: false },
          displayFirstName: {
            value: notifier.email!.split('@')[0],
            canRead: true,
            canEdit: false,
          },
          displayLastName: { value: '', canRead: true, canEdit: false },
          timezone: {
            value: this.config.defaultTimeZone,
            canRead: true,
            canEdit: false,
          },
        } satisfies ProjectStepChangedProps['recipient']);

    return {
      recipient,
      changedBy: this.users.secure(changedBy, recipientSession),
      project: this.projects.secure(project, recipientSession),
      previousStep,
      primaryPartnerName,
    };
  }
}
