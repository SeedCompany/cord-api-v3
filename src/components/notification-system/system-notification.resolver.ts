import {
  Args,
  Field,
  Int,
  Mutation,
  ObjectType,
  Resolver,
} from '@nestjs/graphql';
import { ID, LoggedInSession, Session, UnauthorizedException } from '~/common';
import { MarkdownScalar } from '~/common/markdown.scalar';
import { isAdmin } from '~/common/session';
import { NotificationService } from '../notifications';
import { SystemNotification } from './system-notification.dto';

@ObjectType()
export class SystemNotificationCreationOutput {
  @Field(() => SystemNotification)
  notification: SystemNotification;

  @Field(() => Int)
  totalRecipients: number;
}

@Resolver(SystemNotification)
export class SystemNotificationResolver {
  constructor(private readonly notifications: NotificationService) {}

  @Mutation(() => SystemNotificationCreationOutput)
  async createSystemNotification(
    @Args({ name: 'message', type: () => MarkdownScalar }) message: string,
    @LoggedInSession() session: Session,
  ): Promise<SystemNotificationCreationOutput> {
    if (!isAdmin(session)) {
      throw new UnauthorizedException();
    }

    // @ts-expect-error this is just for testing
    const allUsers = await this.notifications.repo.db
      .query<{ id: ID }>('match (u:User) return u.id as id')
      .map('id')
      .run();

    return await this.notifications.create(SystemNotification, allUsers, {
      message,
    });
  }
}
