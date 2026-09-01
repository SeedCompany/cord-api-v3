import { Args, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { from, map, merge, mergeMap } from 'rxjs';
import { omitNotFound$, Subscription } from '~/common';
import { Loader, type LoaderOf } from '~/core/data-loader';
import { ResourceLoader } from '~/core/resources';
import {
  User,
  UserCreated,
  UserDeleted,
  UserMutation,
  UserMutationOrDeletion,
  UserUpdated,
} from './dto';
import {
  UserChannels,
  UserCreatedArgs,
  UserMutationArgs,
  type UserMutationPayload,
} from './user.channels';
import { UserLoader } from './user.loader';

@Resolver(UserMutation)
export class UserMutationSubscriptionsResolver {
  constructor(
    private readonly channels: UserChannels,
    private readonly loaders: ResourceLoader,
  ) {}

  private verifyReadPermission$() {
    return mergeMap(<Payload extends UserMutationPayload>(payload: Payload) => {
      // Omit event if the user watching doesn't have permission to view the user
      return from(this.loaders.load('User', payload.user)).pipe(
        omitNotFound$(),
        map(() => payload),
      );
    });
  }

  @Subscription(() => UserCreated)
  userCreated(@Args() args: UserCreatedArgs) {
    return this.channels.created(args).pipe(
      this.verifyReadPermission$(),
      map(
        ({ user, ...rest }): UserCreated => ({
          __typename: 'UserCreated',
          userId: user,
          ...rest,
        }),
      ),
    );
  }

  @Subscription(() => UserUpdated)
  userUpdated(@Args() args: UserMutationArgs) {
    return this.channels.updated(args).pipe(
      this.verifyReadPermission$(),
      map(
        ({ user, ...rest }): UserUpdated => ({
          __typename: 'UserUpdated',
          userId: user,
          ...rest,
        }),
      ),
    );
  }

  @Subscription(() => UserDeleted)
  userDeleted(@Args() args: UserMutationArgs) {
    return this.channels.deleted(args).pipe(
      // Cannot read a deleted record.
      // It is ok IMO to expose an ID that cannot be read anymore.
      // this.verifyReadPermission$(),
      map(
        ({ user, ...rest }): UserDeleted => ({
          __typename: 'UserDeleted',
          userId: user,
          ...rest,
        }),
      ),
    );
  }

  @Subscription(() => UserMutationOrDeletion, {
    description: 'Subscribe to any mutations of user(s)',
  })
  userMutations(@Args() args: UserMutationArgs) {
    return merge(
      this.userCreated(args),
      this.userUpdated(args),
      this.userDeleted(args),
    );
  }

  @ResolveField(() => User)
  async user(
    @Parent() change: UserMutation,
    @Loader(UserLoader) users: LoaderOf<UserLoader>,
  ): Promise<User> {
    return await users.load(change.userId);
  }
}
