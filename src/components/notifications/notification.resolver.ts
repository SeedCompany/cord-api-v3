import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ListArg } from '~/common';
import { Identity } from '~/core/authentication';
import {
  MarkNotificationReadArgs,
  Notification,
  NotificationList,
  NotificationListInput,
} from './dto';
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
  async readNotification(@Args() input: MarkNotificationReadArgs): Promise<Notification> {
    return await this.service.markRead(input);
  }
}
