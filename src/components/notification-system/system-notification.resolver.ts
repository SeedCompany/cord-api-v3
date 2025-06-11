import { Args, Field, Int, Mutation, ObjectType, Resolver } from '@nestjs/graphql';
import { MarkdownScalar } from '~/common/markdown.scalar';
import { Privileges } from '../authorization';
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
  constructor(
    private readonly notifications: NotificationService,
    private readonly privileges: Privileges,
  ) {}

  @Mutation(() => SystemNotificationCreationOutput)
  async createSystemNotification(
    @Args({ name: 'message', type: () => MarkdownScalar }) message: string,
  ): Promise<SystemNotificationCreationOutput> {
    this.privileges.for(SystemNotification).verifyCan('create');
    return await this.notifications.create(SystemNotification, null, {
      message,
    });
  }
}
