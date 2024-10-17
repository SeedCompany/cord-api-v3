import {
  Args,
  Field,
  Int,
  Mutation,
  ObjectType,
  Resolver,
} from '@nestjs/graphql';
import { LoggedInSession, Session, UnauthorizedException } from '~/common';
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

    return await this.notifications.create(SystemNotification, null, {
      message,
    });
  }
}
