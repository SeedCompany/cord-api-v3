import {
  Args,
  ID as IDScalar,
  Mutation,
  Parent,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { ID, LoggedInSession, Session, UnauthorizedException } from '~/common';
import { isAdmin } from '~/common/session';
import { Loader, LoaderOf } from '~/core';
import { NotificationService } from '../notifications';
import { UserLoader } from '../user';
import { User } from '../user/dto';
import { SimpleTextNotification as SimpleText } from './simple-text-notification.dto';

@Resolver(SimpleText)
export class SimpleTextNotificationResolver {
  constructor(private readonly notifications: NotificationService) {}

  @ResolveField(() => User, { nullable: true })
  async reference(
    @Parent() { reference }: SimpleText,
    @Loader(UserLoader) users: LoaderOf<UserLoader>,
  ) {
    if (!reference) {
      return null;
    }
    return await users.load(reference.id);
  }

  @Mutation(() => Boolean)
  async testCreateSimpleTextNotification(
    @Args('content') content: string,
    @Args({ name: 'reference', nullable: true, type: () => IDScalar })
    reference: ID | null,
    @LoggedInSession() session: Session,
  ) {
    if (!isAdmin(session)) {
      throw new UnauthorizedException();
    }

    // @ts-expect-error this is just for testing
    const allUsers = await this.notifications.repo.db
      .query<{ id: ID }>('match (u:User) return u.id as id')
      .map('id')
      .run();

    await this.notifications.create(SimpleText, allUsers, {
      content,
      reference,
    });

    return true;
  }
}
