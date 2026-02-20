import { forwardRef, Inject } from '@nestjs/common';
import {
  asNonEmptyArray,
  asyncPool,
  mapValues,
  type NonEmptyArray,
} from '@seedcompany/common';
import { type EmailMessage, MailerService } from '@seedcompany/nestjs-email';
import { type ID } from '~/common';
import { Identity } from '~/core/authentication';
import { Broadcaster } from '~/core/broadcast';
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
  ) {
    super();
  }

  async process(job: Job) {
    const { notification, typeName, recipients } = job.data;
    const strategy = this.notifications.strategiesByNameType.get(typeName)!;

    const channelsForUsers = await this.resolveChannelsForUsers(
      typeName,
      strategy,
      recipients,
    );

    this.deliverToAppChannel(notification, [
      // Always broadcast to static targets (they're not users with prefs)
      ...strategy.broadcastTo(),
      ...(channelsForUsers.App ?? []),
    ]);

    await this.deliverToEmailChannel(
      strategy,
      notification,
      channelsForUsers.Email,
    );
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

  deliverToAppChannel(notification: Notification, targets: readonly string[]) {
    const appPayload = { notification }; // maintain object identity for webhook batching
    for (const target of targets) {
      this.broadcaster.channel(NotificationAdded, target).publish(appPayload);
    }
  }

  async deliverToEmailChannel(
    strategy: INotificationStrategy<Notification>,
    notification: Notification,
    userIds: NonEmptyArray<ID<'User'>> | undefined,
  ) {
    if (!strategy.renderEmail || !userIds) {
      return;
    }
    const users = await this.identity.asRole(
      'Administrator',
      async () => await this.users.readMany(userIds),
    );
    await asyncPool(Infinity, users, async (user) => {
      const email = user.email.value;
      if (!email) return;
      await this.identity.asUser(user.id, async () => {
        const msg: EmailMessage<any> = strategy.renderEmail!(notification);
        await this.mailer.send(msg.withHeaders({ to: email }));
      });
    });
  }
}
