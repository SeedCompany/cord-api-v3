import { EmailService } from '@seedcompany/nestjs-email';
import { RequireExactlyOne } from 'type-fest';
import { ID, mapFromList, Role, UnsecuredDto } from '~/common';
import {
  ConfigService,
  EventsHandler,
  IEventHandler,
  ILogger,
  Logger,
} from '~/core';
import {
  ProgressReportStatusChangedProps as EmailReportStatusNotification,
  ProgressReportStatusChanged,
} from '~/core/email/templates/progress-report-status-changed.template';
import { AuthenticationService } from '../../../authentication';
import { LanguageService } from '../../../language';
import { PeriodicReportService } from '../../../periodic-report';
import { ProjectService } from '../../../project';
import { UserService } from '../../../user';
import { ProgressReportStatus as Status } from '../../dto';
import { ProgressReportWorkflowEvent } from '../dto/workflow-event.dto';
import { WorkflowUpdatedEvent } from '../events/workflow-updated.event';
import { ProgressReportWorkflowRepository } from '../progress-report-workflow.repository';
import { ProgressReportWorkflowService } from '../progress-report-workflow.service';
import { InternalTransition } from '../transitions';

const rolesToAlwaysNotify = [
  Role.ProjectManager,
  Role.RegionalDirector,
  Role.FieldOperationsDirector,
];

@EventsHandler(WorkflowUpdatedEvent)
export class ProgressReportWorkflowNotificationHandler
  implements IEventHandler<WorkflowUpdatedEvent>
{
  constructor(
    private readonly auth: AuthenticationService,
    private readonly repo: ProgressReportWorkflowRepository,
    private readonly configService: ConfigService,
    private readonly userService: UserService,
    private readonly projectService: ProjectService,
    private readonly languageService: LanguageService,
    private readonly reportService: PeriodicReportService,
    private readonly emailService: EmailService,
    private readonly workflowService: ProgressReportWorkflowService,
    @Logger('progress-report:status-change-notifier')
    private readonly logger: ILogger,
  ) {}

  async handle({
    reportId,
    previousStatus,
    next,
    workflowEvent,
  }: WorkflowUpdatedEvent) {
    const { enabled } = this.configService.progressReportStatusChange;
    if (!enabled) {
      return;
    }
    const { projectId, languageId } = await this.repo.getProjectInfoByReportId(
      reportId,
    );

    const userIdByEmail: Record<string, ID | undefined> = mapFromList(
      [
        ...(await this.getEnvNotifyees(next)),
        ...(await this.getProjectNotifyees(reportId, next)),
      ],
      ({ id, email }) => [email, id],
    );

    const notifications = await Promise.all(
      Object.entries(userIdByEmail).map(([email, userId]) =>
        this.prepareNotificationObject(
          reportId,
          previousStatus,
          userId ? { userId } : { email },
          workflowEvent,
          projectId,
          languageId,
        ),
      ),
    );

    this.logger.info('Notifying', {
      emails: notifications.map((r) => r.recipient.email.value),
      projectId: notifications[0]?.project.id ?? undefined,
      languageId: notifications[0]?.language.id ?? undefined,
      reportId: reportId,
      newStatusVal: notifications[0]?.newStatusVal ?? undefined,
      previousStatusVal: notifications[0]?.previousStatusVal ?? undefined,
    });

    for (const notification of notifications) {
      if (notification.recipient.email.value) {
        await this.emailService.send(
          notification.recipient.email.value,
          ProgressReportStatusChanged,
          notification,
        );
      }
    }
  }

  private async prepareNotificationObject(
    reportId: ID,
    previousStatus: Status,
    receiver: RequireExactlyOne<{ userId: ID; email: string }>,
    unsecuredEvent: UnsecuredDto<ProgressReportWorkflowEvent>,
    projectId: ID,
    languageId: ID,
  ): Promise<EmailReportStatusNotification> {
    const recipientId = receiver.userId
      ? receiver.userId
      : this.configService.rootAdmin.id;
    const recipientSession = await this.auth.sessionForUser(recipientId);

    const recipient = receiver.userId
      ? await this.userService.readOne(recipientId, recipientSession)
      : this.fakeUserFromEmailAddress(receiver.email!);

    const project = await this.projectService.readOne(
      projectId,
      recipientSession,
    );
    const language = await this.languageService.readOne(
      languageId,
      recipientSession,
    );
    const report = await this.reportService.readOne(reportId, recipientSession);
    const changedBy = await this.userService.readOne(
      unsecuredEvent.who,
      recipientSession,
    );
    const workflowEvent = this.workflowService.secure(
      unsecuredEvent,
      recipientSession,
    );

    return {
      changedBy,
      recipient,
      project,
      language,
      report,
      newStatusVal: report.status?.value,
      previousStatusVal: report.status?.value ? previousStatus : undefined,
      workflowEvent: workflowEvent,
    };
  }

  private fakeUserFromEmailAddress(
    receiver: string,
  ): EmailReportStatusNotification['recipient'] {
    return {
      email: { value: receiver, canRead: true, canEdit: false },
      displayFirstName: {
        value: receiver.split('@')[0],
        canRead: true,
        canEdit: false,
      },
      displayLastName: { value: '', canRead: true, canEdit: false },
      timezone: {
        value: this.configService.defaultTimeZone,
        canRead: true,
        canEdit: false,
      },
    };
  }

  private async getEnvNotifyees(next: Status | InternalTransition) {
    const { forTransitions, forBypasses } =
      this.configService.progressReportStatusChange.notifyExtraEmails;
    const envEmailList =
      typeof next !== 'string'
        ? forTransitions.get(next.name)
        : forBypasses.get(next);
    return [
      ...(envEmailList?.map((email) => ({ id: undefined, email })) ?? []),
      ...(envEmailList ? await this.repo.getUserIdByEmails(envEmailList) : []),
    ];
  }

  private async getProjectNotifyees(
    reportId: ID,
    next: Status | InternalTransition,
  ) {
    const roles = [
      ...rolesToAlwaysNotify,
      ...(typeof next !== 'string' ? next.notify?.membersWithRoles ?? [] : []),
    ];

    const members = await this.repo.getProjectMemberInfoByReportId(reportId);
    return members.filter((mbr) =>
      mbr.roles.some((role) => roles.includes(role)),
    );
  }
}
