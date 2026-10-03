import { ModuleRef } from '@nestjs/core';
import { many } from '@seedcompany/common';
import { NotFoundException, type UnsecuredDto } from '~/common';
import { Identity } from '~/core/authentication';
import { ConfigService } from '~/core/config';
import { TransactionHooks } from '~/core/database';
import { MailerService } from '~/core/email';
import { OnHook } from '~/core/hooks';
import { ILogger, Logger } from '~/core/logger';
import { ProjectService } from '../../../project';
import { UserService } from '../../../user';
import {
  type Notifier,
  type TransitionNotifier,
} from '../../../workflow/transitions/notifiers';
import { type GtlReportWorkflowEvent as WorkflowEvent } from '../dto';
import {
  GtlReportStatusChanged,
  type GtlReportStatusChangedProps as Props,
} from '../emails/gtl-report-status-changed.email';
import { GtlReportWorkflowRepository } from '../gtl-report-workflow.repository';
import { GtlReportWorkflowService } from '../gtl-report-workflow.service';
import { GtlReportTransitionedHook } from '../hooks/gtl-report-transitioned.hook';
import { type ResolveParams } from '../transitions/context';

type NotificationInfo = Awaited<
  ReturnType<GtlReportWorkflowRepository['getNotificationInfo']>
>;

/**
 * Emails the people a transition names (`notifiers` on the workflow) when a
 * GTL report changes status.
 *
 * Recipients come from the transition's declared notifiers, so a workflow
 * bypass — which has no transition — notifies nobody, and the person who made
 * the change is never emailed about their own action.
 *
 * Runs inside the mutation's transaction, so nothing here may fail the status
 * change: each recipient's email is prepared under its own try/catch, and the
 * sends are held until the transaction commits.
 */
@OnHook(GtlReportTransitionedHook)
export class GtlReportWorkflowNotificationHandler {
  constructor(
    private readonly identity: Identity,
    private readonly config: ConfigService,
    private readonly users: UserService,
    private readonly projects: ProjectService,
    private readonly mailer: MailerService,
    private readonly workflowService: GtlReportWorkflowService,
    private readonly repo: GtlReportWorkflowRepository,
    private readonly txHooks: TransactionHooks,
    private readonly moduleRef: ModuleRef,
    @Logger('gtl-report:status-change-notifier')
    private readonly logger: ILogger,
  ) {}

  async handle(event: GtlReportTransitionedHook) {
    if (!this.config.gtlReportStatusChange.enabled) {
      return;
    }
    const transition = typeof event.next !== 'string' ? event.next : undefined;
    if (!transition || transition.notifiers.length === 0) {
      return;
    }

    const recipients = await this.resolveRecipients(
      transition.notifiers,
      event,
    );
    if (recipients.length === 0) {
      return;
    }

    const info = await this.repo.getNotificationInfo(event.report.id);

    const notifications = (
      await Promise.all(
        recipients.map(async (recipient) => {
          try {
            const props = await this.prepareProps(recipient, event, info);
            return { to: recipient.email, props };
          } catch (exception) {
            // One recipient's email must not take the status change down with
            // it — or the other recipients' emails.
            this.logger.error('Failed to prepare status change notification', {
              recipient: recipient.email,
              reportId: event.report.id,
              exception,
            });
            return null;
          }
        }),
      )
    ).flatMap((notification) => (notification ? [notification] : []));

    this.logger.info('Notifying', {
      emails: notifications.map((notification) => notification.to),
      reportId: event.report.id,
      projectId: info.projectId,
      transition: transition.name,
      previousStatus: event.previousStatus,
      newStatus: event.workflowEvent.to,
    });

    const send = async () => {
      for (const { to, props } of notifications) {
        try {
          await this.mailer
            .compose(to, <GtlReportStatusChanged {...props} />)
            .send();
        } catch (exception) {
          // A failed send must not fail (or roll back) the status change.
          this.logger.error('Failed to send status change notification', {
            recipient: to,
            reportId: event.report.id,
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

  /**
   * Everyone the transition names, once each by email, minus the person who
   * made the change and anyone with no email to send to.
   */
  private async resolveRecipients(
    notifiers: ReadonlyArray<TransitionNotifier<ResolveParams>>,
    event: GtlReportTransitionedHook,
  ): Promise<ReadonlyArray<Notifier & { email: string }>> {
    const params: ResolveParams = {
      report: event.report,
      moduleRef: this.moduleRef,
    };
    const resolved = (
      await Promise.all(
        notifiers.map(async (notifier) => many(await notifier.resolve(params))),
      )
    ).flat();

    const actorId = this.identity.current.userId;
    const byEmail = new Map<string, Notifier & { email: string }>();
    for (const notifier of resolved) {
      if (!notifier.email || notifier.id === actorId) {
        continue;
      }
      const key = notifier.email.toLowerCase();
      if (!byEmail.has(key)) {
        byEmail.set(key, { ...notifier, email: notifier.email });
      }
    }
    return [...byEmail.values()];
  }

  /**
   * The email's content as this recipient is allowed to see it. Everything is
   * read as the recipient, so a name they may not read renders as the
   * template's placeholder rather than leaking.
   */
  private async prepareProps(
    recipient: Notifier & { email: string },
    event: GtlReportTransitionedHook,
    info: NotificationInfo,
  ): Promise<Props> {
    const recipientId = recipient.id;
    return await this.identity.asUser(
      recipientId ?? this.config.rootUser.id,
      async () => {
        const recipientUser = recipientId
          ? await this.readOrElse(
              () => this.users.readOne(recipientId),
              () => this.fakeUserFromEmailAddress(recipient.email),
            )
          : this.fakeUserFromEmailAddress(recipient.email);

        // The leader is usually not a project member, so the project read
        // hides the row from them; they still get the email, with the
        // project unnamed.
        const project = await this.readOrElse(
          () => this.projects.readOne(info.projectId),
          (): Props['project'] => ({
            id: info.projectId,
            name: { canRead: false, canEdit: false },
          }),
        );

        // The leader is the engagement's intern; a GTL report cannot exist
        // without one (the engagement-shape CHECK), so a missing id is a
        // defect worth failing this recipient's email over, not papering
        // over.
        const internId = info.internId;
        if (!internId) {
          throw new Error(
            `GTL report ${event.report.id}'s engagement has no intern`,
          );
        }
        const leader = await this.readOrElse(
          () => this.users.readOne(internId),
          (): Props['leader'] => ({ id: internId }),
        );

        // A change by a system agent, or an actor this recipient cannot read,
        // degrades to the actor-less sentence.
        const changedByActor = (
          await this.users.readManyActors([event.workflowEvent.who.id])
        )[0];
        const changedBy =
          changedByActor?.__typename === 'User' ? changedByActor : undefined;

        return {
          changedBy,
          recipient: recipientUser,
          project,
          leader,
          engagement: { id: info.engagementId },
          report: { id: event.report.id, start: event.report.start },
          newStatusVal: event.workflowEvent.to,
          previousStatusVal: event.previousStatus,
          workflowEvent: await this.eventAsRecipient(event.workflowEvent),
        };
      },
    );
  }

  /**
   * The event secured for the CURRENT (recipient) identity.
   *
   * The unsecured event carries the membership scope of whoever made the
   * change, and the member-conditioned read on `who` and `notes` is answered
   * from that scope — so securing it as-is would judge the recipient by the
   * actor's membership. Re-reading it attaches the recipient's own scope and
   * applies their read filter; a recipient the filter excludes gets the event
   * with no scope, so only global grants can open `notes` for them.
   */
  private async eventAsRecipient(
    unsecured: UnsecuredDto<WorkflowEvent>,
  ): Promise<WorkflowEvent> {
    const [readable] = await this.workflowService.readMany([unsecured.id]);
    return readable ?? this.workflowService.secure({ ...unsecured, scope: [] });
  }

  /**
   * A read that may legitimately answer "not found" for THIS recipient: the
   * repositories' read filters hide rows the requester may not see. That is
   * not a reason to withhold the email — the piece renders as the template's
   * placeholder instead. Any other failure is real and still drops this
   * recipient's email.
   */
  private async readOrElse<T, Fallback>(
    read: () => Promise<T>,
    fallback: () => Fallback,
  ): Promise<T | Fallback> {
    try {
      return await read();
    } catch (exception) {
      if (exception instanceof NotFoundException) {
        return fallback();
      }
      throw exception;
    }
  }

  private fakeUserFromEmailAddress(email: string): Props['recipient'] {
    return {
      email: { value: email, canRead: true, canEdit: false },
      displayFirstName: {
        value: email.split('@')[0],
        canRead: true,
        canEdit: false,
      },
      displayLastName: { value: '', canRead: true, canEdit: false },
      timezone: {
        value: this.config.defaultTimeZone,
        canRead: true,
        canEdit: false,
      },
    };
  }
}
