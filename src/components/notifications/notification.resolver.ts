import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  ListArg,
  LoggedInSession,
  NotImplementedException,
  Session,
} from '~/common';
import {
  MarkNotificationReadArgs,
  Notification,
  NotificationList,
  NotificationListInput,
} from './dto';

@Resolver()
export class NotificationResolver {
  @Query(() => NotificationList)
  async notifications(
    @LoggedInSession() session: Session,
    @ListArg(NotificationListInput) input: NotificationListInput,
  ): Promise<NotificationList> {
    throw new NotImplementedException().with(input, session);
  }

  @Mutation(() => Notification)
  async readNotification(
    @LoggedInSession() session: Session,
    @Args() input: MarkNotificationReadArgs,
  ): Promise<Notification> {
    throw new NotImplementedException().with(input, session);
  }
}
