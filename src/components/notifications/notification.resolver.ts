import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AnonSession, ListArg, LoggedInSession, type Session } from '~/common';
import {
  MarkNotificationReadArgs,
  Notification,
  NotificationList,
  NotificationListInput,
} from './dto';
import { NotificationServiceImpl } from './notification.service';

@Resolver()
export class NotificationResolver {
  constructor(private readonly service: NotificationServiceImpl) {}

  @Query(() => NotificationList)
  async notifications(
    @AnonSession() session: Session,
    @ListArg(NotificationListInput) input: NotificationListInput,
  ): Promise<NotificationList> {
    // TODO move to DB layer?
    if (session.anonymous) {
      return { items: [], total: 0, totalUnread: 0, hasMore: false };
    }
    return await this.service.list(input, session);
  }

  @Mutation(() => Notification)
  async readNotification(
    @LoggedInSession() session: Session,
    @Args() input: MarkNotificationReadArgs,
  ): Promise<Notification> {
    return await this.service.markRead(input, session);
  }
}
