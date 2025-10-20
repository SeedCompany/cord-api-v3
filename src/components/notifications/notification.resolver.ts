import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { ListArg, Subscription } from '~/common';
import { Identity } from '~/core/authentication';
import {
  MarkNotificationReadArgs,
  Notification,
  NotificationList,
  NotificationListInput,
} from './dto';
import { NotificationAdded } from './dto/notification-added.event';
import { NotificationServiceImpl } from './notification.service';

@Resolver()
export class NotificationResolver {
  constructor(
    private readonly service: NotificationServiceImpl,
    private readonly identity: Identity,
  ) {}

  @Query(() => NotificationList)
  async notifications(
    @ListArg(NotificationListInput) input: NotificationListInput,
  ): Promise<NotificationList> {
    // TODO move to DB layer?
    if (this.identity.isAnonymous) {
      return { items: [], total: 0, totalUnread: 0, hasMore: false };
    }
    return await this.service.list(input);
  }

  @Mutation(() => Notification)
  async readNotification(
    @Args() input: MarkNotificationReadArgs,
  ): Promise<Notification> {
    return await this.service.markRead(input);
  }

  @Subscription<NotificationAdded>(() => NotificationAdded, {
    description: stripIndent`
      Subscribe to new notifications that are added/created
      for the current user
    `,
  })
  notificationAdded() {
    return this.service.added$(this.identity.current.userId);
  }
}
