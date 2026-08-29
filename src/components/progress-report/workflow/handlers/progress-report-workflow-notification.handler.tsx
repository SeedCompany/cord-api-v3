import { entries, mapEntries } from '@seedcompany/common';
import { type RequireExactlyOne } from 'type-fest';
import { type ID, Role, type UnsecuredDto } from '~/common';
import { Identity } from '~/core/authentication';
import { ConfigService } from '~/core/config';
import { TransactionHooks } from '~/core/database';
import { MailerService } from '~/core/email';
import { OnHook } from '~/core/hooks';
import { ILogger, Logger } from '~/core/logger';
import { LanguageService } from '../../../language';
import { PeriodicReportService } from '../../../periodic-report';
import { ProjectService } from '../../../project';
import { UserService } from '../../../user';
import { type ProgressReportStatus as Status } from '../../dto';
import { type ProgressReportWorkflowEvent } from '../dto/workflow-event.dto';
import {
  type ProgressReportStatusChangedProps as EmailReportStatusNotification,
  ProgressReportStatusChanged,
} from '../emails/progress-report-status-changed.email';
import { WorkflowUpdatedHook } from '../hooks/workflow-updated.hook';
import { ProgressReportWorkflowRepository } from '../progress-report-workflow.repository';
import { ProgressReportWorkflowService } from '../progress-report-workflow.service';
import { type InternalTransition } from '../transitions';

const rolesToAlwaysNotify = [
  Role.ProjectManager,
  Role.RegionalDirector,
  Role.FieldOperationsDirector,
];

@OnHook(WorkflowUpdatedHook)
export class ProgressReportWorkflowNotificationHandler {
  constructor(
    private readonly identity: Identity,
    private readonly repo: ProgressReportWorkflowRepository,
    private readonly configService: ConfigService,
    private readonly userService: UserService,
    private readonly projectService: ProjectService,
    private readonly languageService: LanguageService,
    private readonly reportService: PeriodicReportService,
    private readonly mailer: MailerService,
    private readonly workflowService: ProgressReportWorkflowService,
    private readonly txHooks: TransactionHooks,
    @Logger('progress-report:status-change-notifier')
    private readonly logger: ILogger,
  ) {}

  async handle({
    reportId,
    previousStatus,
    next,
    workflowEvent,
    automatedReason,
  }: WorkflowUpdatedHook) {
    const { enabled } = this.configService.progressReportStatusChange;
    if (!enabled) {
      return;
    }
    const { projectId, languageId } =
      await this.repo.getProjectInfoByReportId(reportId);

    const userIdByEmail = mapEntries(
      [
        ...(await this.getEnvNotifyees(next)),
        ...(await this.getProjectNotifyees(reportId, next)),
      ],
      ({ id, email }) => [email, id],
    ).asMap;

    const notifications = (
      await Promise.all(
        entries(userIdByEmail).map(async ([email, userId]) => {
          try {
            return await this.prepareNotificationObject(
              reportId,
              previousStatus,
              userId ? { userId } : { email },
              workflowEvent,
              projectId,
              languageId,
              automatedReason,
            );
          } catch (exception) {
            // Hooks run inside the transaction — losing one recipient's email
            // must not roll back the status change (or the whole ingest).
            this.logger.error('Failed to prepare status change notification', {
              recipient: email,
              reportId,
              exception,
            });
            return null;
          }
        }),
      )
    ).flatMap((notification) => (notification ? [notification] : []));

    this.logger.info('Notifying', {
      emails: notifications.map((r) => r.recipient.email.value),
      projectId: notifications[0]?.project.id ?? undefined,
      languageId: notifications[0]?.language.id ?? undefined,
      reportId: reportId,
      newStatusVal: notifications[0]?.newStatusVal ?? undefined,
      previousStatusVal: notifications[0]?.previousStatusVal ?? undefined,
    });

    const send = async () => {
      for (const notification of notifications) {
        const email = notification.recipient.email.value;
        if (!email) {
          continue;
        }
        try {
          await this.mailer
            .compose(email, <ProgressReportStatusChanged {...notification} />)
            .send();
        } catch (exception) {
          // A failed send must not fail (or roll back) the status change.
          this.logger.error('Failed to send status change notification', {
            recipient: email,
            reportId,
            exception,
          });
        }
      }
    };

    // Emails are outbound side effects — hold them until the mutation's
    // transaction commits, so a rolled-back attempt cannot send and a retry
    // cannot re-send emails for writes that never persisted.
    await this.txHooks.afterCommitOrNow(send);
  }

  private async prepareNotificationObject(
    reportId: ID,
    previousStatus: Status,
    receiver: RequireExactlyOne<{ userId: ID; email: string }>,
    unsecuredEvent: UnsecuredDto<ProgressReportWorkflowEvent>,
    projectId: ID,
    languageId: ID,
    automatedReason?: string,
  ): Promise<EmailReportStatusNotification> {
    const recipientId = receiver.userId ?? this.configService.rootUser.id;
    return await this.identity.asUser(recipientId, async () => {
      const recipient = receiver.userId
        ? await this.userService.readOne(recipientId)
        : this.fakeUserFromEmailAddress(receiver.email!);

      const project = await this.projectService.readOne(projectId);
      const language = await this.languageService.readOne(languageId);
      const report = await this.reportService.readOne(reportId);
      // The template only names the actor for human changes — automated ones
      // carry the reason sentence instead — so skip the read entirely there.
      // An agent or unloadable actor degrades to the actor-less sentence.
      const changedByActor = automatedReason
        ? undefined
        : (await this.userService.readManyActors([unsecuredEvent.who.id]))[0];
      const changedBy =
        changedByActor?.__typename === 'User' ? changedByActor : undefined;
      const workflowEvent = this.workflowService.secure(unsecuredEvent);

      return {
        changedBy,
        recipient,
        project,
        language,
        report,
        newStatusVal: report.status?.value,
        previousStatusVal: report.status?.value ? previousStatus : undefined,
        workflowEvent: workflowEvent,
        automatedReason,
      };
    });
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
      ...(typeof next !== 'string'
        ? (next.notify?.membersWithRoles ?? [])
        : []),
    ];

    const members = await this.repo.getProjectMemberInfoByReportId(reportId);
    return members.filter((mbr) =>
      mbr.roles.some((role) => roles.includes(role)),
    );
  }
}
