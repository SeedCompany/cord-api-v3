import { ModuleRef } from '@nestjs/core';
import { many } from '@seedcompany/common';
import { type ID, type UnsecuredDto } from '~/common';
import { Identity } from '~/core/authentication';
import { ConfigService } from '~/core/config';
import { MailerService } from '~/core/email';
import { OnHook } from '~/core/hooks';
import { ILogger, Logger } from '~/core/logger';
import { NotificationService } from '../../../notifications';
import { ProjectService } from '../../../project';
import { UserService } from '../../../user';
import { type User } from '../../../user/dto';
import { type Notifier } from '../../../workflow/transitions/notifiers';
import { type Project, type ProjectStep } from '../../dto';
import {
  ProjectStepChanged,
  type ProjectStepChangedProps,
} from '../emails/project-step-changed.email';
import { ProjectTransitionedHook } from '../hooks/project-transitioned.hook';
import { ProjectTransitionRequiringFinancialApprovalNotification } from '../notifications/project-transition-requiring-financial-approval-notification.dto';
import { ProjectTransitionViaMembershipNotification } from '../notifications/project-transition-via-membership-notification.dto';
import { FinancialApprovers, TeamMembers } from '../transitions/notifiers';

@OnHook(ProjectTransitionedHook)
export class ProjectWorkflowNotificationHandler {
  constructor(
    private readonly identity: Identity,
    private readonly config: ConfigService,
    private readonly users: UserService,
    private readonly projects: ProjectService,
    private readonly mailer: MailerService,
    private readonly moduleRef: ModuleRef,
    private readonly notifier: NotificationService,
    @Logger('project:step-change-notifier')
    private readonly logger: ILogger,
  ) {}

  async handle(event: ProjectTransitionedHook) {
    const { previousStep, next, workflowEvent } = event;
    const transition = typeof next !== 'string' ? next : undefined;

    const currentUserId = this.identity.current.userId;

    // TODO on bypass: keep notifying members? add anyone else?
    const notifiers = transition?.notifiers ?? [];

    const params = {
      project: event.project,
      previousStep,
      moduleRef: this.moduleRef,
    };

    const notificationInput = {
      workflowEvent: workflowEvent.id,
      previousStep,
    };

    // Resolve each notifier separately so we can categorize them
    await Promise.all(
      notifiers.map(async (notifier) => {
        const resolved = many(await notifier.resolve(params));

        if (notifier === TeamMembers) {
          const userIds = resolved
            .filter((n): n is Notifier & { id: ID<'User'> } => !!n.id)
            .map((n) => n.id)
            .filter((id) => id !== currentUserId);
          if (userIds.length > 0) {
            this.logger.info('Notifying team members via notification system', {
              userIds,
              projectId: event.project.id,
              previousStep,
              toStep: workflowEvent.to,
            });
            await this.notifier.create(
              ProjectTransitionViaMembershipNotification,
              userIds,
              notificationInput,
            );
          }
          return;
        }

        if (notifier === FinancialApprovers) {
          const userIds = resolved
            .filter((n): n is Notifier & { id: ID<'User'> } => !!n.id)
            .map((n) => n.id)
            .filter((id) => id !== currentUserId);
          if (userIds.length > 0) {
            this.logger.info(
              'Notifying financial approvers via notification system',
              {
                userIds,
                projectId: event.project.id,
                previousStep,
                toStep: workflowEvent.to,
              },
            );
            await this.notifier.create(
              ProjectTransitionRequiringFinancialApprovalNotification,
              userIds,
              notificationInput,
            );
          }
          return;
        }

        // Email distros and other custom notifiers — send emails directly
        const emailNotifyees = resolved.filter(
          (n) => n.email && n.id !== currentUserId,
        );
        if (emailNotifyees.length === 0) {
          return;
        }

        this.logger.info('Notifying via direct email', {
          emails: emailNotifyees.map((n) => n.email),
          projectId: event.project.id,
          previousStep,
          toStep: workflowEvent.to,
        });

        await this.sendDirectEmails(emailNotifyees, event);
      }),
    );
  }

  private async sendDirectEmails(
    notifyees: Notifier[],
    event: ProjectTransitionedHook,
  ) {
    const { previousStep, workflowEvent } = event;

    const [changedBy, project, primaryPartnerName] = await this.identity.asUser(
      this.config.rootUser.id,
      async () =>
        await Promise.all([
          this.users.readOneUnsecured(workflowEvent.who.id),
          this.projects.readOneUnsecured(event.project.id),
          this.projects.getPrimaryOrganizationName(event.project.id),
        ]),
    );

    for (const notifier of notifyees) {
      if (!notifier.email) continue;

      const props = this.resolveDistroTemplateProps(
        notifier,
        changedBy,
        project,
        previousStep,
        primaryPartnerName,
      );
      await this.mailer
        .compose(notifier.email, <ProjectStepChanged {...props} />)
        .send();
    }
  }

  private resolveDistroTemplateProps(
    notifier: Notifier,
    changedBy: UnsecuredDto<User>,
    project: UnsecuredDto<Project>,
    previousStep: ProjectStep,
    primaryPartnerName: string | null,
  ): ProjectStepChangedProps {
    return {
      recipient: {
        email: { value: notifier.email!, canRead: true, canEdit: false },
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
      },
      changedBy: this.users.secure(changedBy),
      project: this.projects.secure(project),
      previousStep,
      primaryPartnerName,
    };
  }
}
