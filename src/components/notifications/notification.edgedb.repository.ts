import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { Nil } from '@seedcompany/common';
import { ID, PublicOf, ResourceShape } from '~/common';
import { e, RepoFor, ScopeOf } from '~/core/edgedb';
import {
  MarkNotificationReadArgs,
  Notification,
  NotificationListInput,
} from './dto';
import { NotificationRepository as Neo4jRepository } from './notification.repository';
import { NotificationServiceImpl } from './notification.service';

@Injectable()
export class NotificationRepository
  extends RepoFor(Notification, {
    hydrate: (notification) => ({
      __typename: notification.__type__.name,
      ...notification['*'],
    }),
    omit: ['create', 'update', 'list', 'readOne', 'readMany'],
  })
  implements PublicOf<Neo4jRepository>
{
  constructor(
    @Inject(forwardRef(() => NotificationServiceImpl))
    private readonly service: NotificationServiceImpl & {},
  ) {
    super();
  }

  onModuleInit() {
    (this as any).hydrate = e.shape(e.Notification, (notification) => {
      return Object.assign(
        {
          __typename: notification.__type__.name,
        },
        notification['*'],
        ...[...this.service.strategyMap.values()].flatMap(
          (strategy) => strategy.hydrateExtraForEdgeDB() ?? [],
        ),
      );
    });
  }

  async create(
    recipients: ReadonlyArray<ID<'User'>> | Nil,
    type: ResourceShape<any>,
    input: Record<string, any>,
  ) {
    const strategy = this.service.getStrategy(type);

    const created = strategy.insertForEdgeDB(input);

    const recipientsQuery = recipients
      ? e.cast(e.User, e.cast(e.uuid, e.set(...recipients)))
      : strategy.recipientsForEdgeDB(input);

    const insertedRecipients = e.for(recipientsQuery, (user) =>
      e.insert(e.Notification.Recipient, {
        notification: created,
        user: user,
      }),
    );

    const query = e.select({
      dto: e.select(created, this.hydrate),
      totalRecipients: e.count(insertedRecipients),
    });

    return await this.db.run(query);
  }

  async markRead({ id, unread }: MarkNotificationReadArgs) {
    const notification = e.cast(e.Notification, e.uuid(id));
    const next = unread ? null : e.datetime_of_transaction();

    const recipient = e.assert_exists(notification.currentRecipient);
    const updated = e.update(recipient, () => ({
      set: { readAt: next },
    }));
    const query = e.select(updated.notification, this.hydrate);
    return await this.db.run(query);
  }

  async list(input: NotificationListInput) {
    const myNotifications = e.select(e.Notification, (notification) => ({
      filter: e.op(e.global.currentUser, 'in', notification.recipients.user),
    }));

    const paginated = this.paginate(myNotifications, input);

    const myUnread = e.select(myNotifications, (notification) => ({
      filter: e.op(notification.unread, '=', true),
    }));

    const query = e.select({
      ...paginated,
      items: e.select(paginated.items as typeof e.Notification, this.hydrate),
      totalUnread: e.count(myUnread),
    });

    return await this.db.run(query);
  }

  protected listFilters(
    notification: ScopeOf<typeof e.Notification>,
    { filter }: NotificationListInput,
  ) {
    return [
      filter?.unread != null && e.op(notification.unread, '=', filter.unread),
    ];
  }
}
