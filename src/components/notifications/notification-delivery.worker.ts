import { forwardRef, Inject } from '@nestjs/common';
import {
  asNonEmptyArray,
  mapValues,
  type NonEmptyArray,
  settled,
} from '@seedcompany/common';
import { type EmailMessage, MailerService } from '@seedcompany/nestjs-email';
import { type ID } from '~/common';
import { Identity } from '~/core/authentication';
import { Broadcaster } from '~/core/broadcast';
import { ILogger, Logger } from '~/core/logger';
import { Processor, WorkerHost } from '~/core/queue';
import { type JobOf } from '~/core/queue';
import { UserService } from '../user';
import {
  type Notification,
  NotificationChannel,
  type NotificationType,
} from './dto';
import { NotificationAdded } from './dto/notification-added.hook';
import { NotificationDeliveryQueue } from './notification-delivery.queue';
import { NotificationServiceImpl } from './notification.service';
import { type INotificationStrategy } from './notification.strategy';
import { NotificationPreferencesService } from './preferences/notification-preferences.service';

type Job = JobOf<NotificationDeliveryQueue>;

interface JobProgress {
  channels?: Awaited<
    ReturnType<NotificationDeliveryWorker['resolveChannelsForUsers']>
  >;
  appDelivered?: true;
  emailDelivered?: ReadonlyArray<ID<'User'>>;
}

@Processor(NotificationDeliveryQueue.NAME)
export class NotificationDeliveryWorker extends WorkerHost {
  constructor(
    private readonly mailer: MailerService,
    private readonly identity: Identity,
    private readonly users: UserService,
    @Inject(forwardRef(() => Broadcaster))
    private readonly broadcaster: Broadcaster & {},
    @Inject(forwardRef(() => NotificationPreferencesService))
    private readonly preferencesService: NotificationPreferencesService & {},
    @Inject(forwardRef(() => NotificationServiceImpl))
    private readonly notifications: NotificationServiceImpl & {},
    @Logger('notifications') private readonly logger: ILogger,
  ) {
    super();
  }

  async process(job: Job) {
    const { notification, typeName, recipients } = job.data;
    const strategy = this.notifications.strategiesByNameType.get(typeName)!;

    const progress = createProgressManager<JobProgress>(job);

    if (!progress.get().channels) {
      const resolved = await this.resolveChannelsForUsers(
        typeName,
        strategy,
        recipients,
      );
      await progress.set((prev) => ({
        ...prev,
        channels: resolved,
      }));
    }

    await this.processApp(strategy, notification, progress);

    await this.processEmail(strategy, notification, progress);
  }

  /**
   * Partition the given recipients into channels based on their preferences.
   */
  async resolveChannelsForUsers(
    typeName: NotificationType,
    strategy: INotificationStrategy<Notification>,
    userRecipients: ReadonlyArray<ID<'User'>>,
  ) {
    const overridesMap = await this.preferencesService.getOverridesMap(
      typeName,
      userRecipients,
    );
    const availabilities = strategy.channelAvailabilities();
    return mapValues.fromList(NotificationChannel, (channel) => {
      const availability = availabilities[channel];
      if (availability === 'AlwaysOff') return undefined;
      return asNonEmptyArray(
        availability === 'AlwaysOn'
          ? userRecipients
          : userRecipients.filter(
              (user) =>
                overridesMap.get(user)?.[channel] ??
                availability === 'DefaultOn',
            ),
      );
    }).asRecord;
  }

  private async processApp(
    strategy: INotificationStrategy<Notification>,
    notification: Notification,
    progress: JobProgressor<JobProgress>,
  ) {
    if (progress.get().appDelivered) {
      return;
    }
    this.deliverToAppChannel(notification, [
      // Always broadcast to static targets (they're not users with prefs)
      ...strategy.broadcastTo(),
      ...(progress.get().channels!.App ?? []),
    ]);
    await progress.set((prev) => ({
      ...prev,
      appDelivered: true,
    }));
  }

  private deliverToAppChannel(
    notification: Notification,
    targets: readonly string[],
  ) {
    const appPayload = { notification }; // maintain object identity for webhook batching
    for (const target of targets) {
      this.broadcaster.channel(NotificationAdded, target).publish(appPayload);
    }
  }

  private async processEmail(
    strategy: INotificationStrategy<Notification>,
    notification: Notification,
    progress: JobProgressor<JobProgress>,
  ) {
    if (!strategy.renderEmail) {
      return;
    }
    const remainingUsers = asNonEmptyArray([
      ...new Set(progress.get().channels!.Email).difference(
        new Set(progress.get().emailDelivered ?? []),
      ),
    ]);
    if (!remainingUsers) {
      return;
    }
    const emailResults = await this.deliverToEmailChannel(
      strategy,
      notification,
      remainingUsers,
    );
    const [success, failures] = emailResults;
    if (!failures.length) {
      return;
    }
    await progress.set((prev) => ({
      ...prev,
      emailDelivered: success,
    }));
    const error = new AggregateError(
      failures,
      `Failed to deliver email notifications to ${failures.length} users`,
    );
    this.logger.error(error.message, { exception: error });
    throw error;
  }

  private async deliverToEmailChannel(
    strategy: INotificationStrategy<Notification>,
    notification: Notification,
    userIds: NonEmptyArray<ID<'User'>>,
  ) {
    const users = await this.identity.asRole(
      'Administrator',
      async () => await this.users.readMany(userIds),
    );
    return await settled(
      users.map(async (user) => {
        const email = user.email.value;
        if (!email) return user.id;
        await this.identity.asUser(user.id, async () => {
          const msg: EmailMessage<any> = strategy.renderEmail!(notification);
          await this.mailer.send(msg.withHeaders({ to: email }));
        });
        return user.id;
      }),
    );
  }
}

interface JobProgressor<T> {
  get: () => T;
  set: (getNext: (prev: T) => T) => Promise<T>;
}
const createProgressManager = <T extends object>(
  job: Job,
): JobProgressor<T> => {
  let current = job.progress as T;
  return {
    get: () => current,
    set: async (getNext: (prev: T) => T) => {
      const next = getNext(current);
      current = next;
      await job.updateProgress(next);
      return next;
    },
  };
};
