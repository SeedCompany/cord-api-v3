import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ListArg, LoggedInSession, Session } from '~/common';
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
    @LoggedInSession() session: Session,
    @ListArg(NotificationListInput) input: NotificationListInput,
  ): Promise<NotificationList> {
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
