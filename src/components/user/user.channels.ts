import { Injectable } from '@nestjs/common';
import { ArgsType } from '@nestjs/graphql';
import { type Many, many } from '@seedcompany/common';
import { type DateTime } from 'luxon';
import type { SetRequired } from 'type-fest';
import { type ID, IdField } from '~/common';
import { Identity } from '~/core/authentication';
import {
  Broadcaster,
  type BroadcastChannel as Channel,
  CompositeChannel as Composite,
} from '~/core/broadcast';
import { type UserUpdate } from './dto';

@ArgsType()
export class UserCreatedArgs {}

@ArgsType()
export class UserMutationArgs {
  @IdField({ nullable: true })
  user?: ID<'User'>;
}

export type UserMutationPayload = SetRequired<
  UserMutationArgs,
  keyof UserMutationArgs
> & {
  at: DateTime;
  by: ID<'Actor'>;
};

type Action = 'created' | 'updated' | 'deleted';

/**
 * Typed channels for user events.
 */
@Injectable()
export class UserChannels {
  constructor(
    private readonly identity: Identity,
    private readonly broadcaster: Broadcaster,
  ) {}

  /**
   * Call publish() on the channel action for all arg/filter variations.
   */
  publishToAll<Action extends Exclude<keyof UserChannels, 'publishToAll'>>(
    action: Action,
    payload: ReturnType<UserChannels[Action]> extends Channel<
      infer T extends UserMutationPayload
    >
      ? Omit<T, 'by'>
      : never,
  ) {
    const by =
      action === 'created'
        ? // Self-registration is NOT the fallback case: it runs with an
          // anonymous session, so `by` is the Anonymous SystemAgent — the
          // truthful answer, and `Actor` covers system agents. The fallback is
          // for creation with no session context at all: RootUser bootstrap and
          // seeding (same case the `currentIfInCtx` guard in
          // UserService.create() exists for). There is no actor to name there,
          // so the new user is attributed as their own creator.
          // `currentIfInCtx` is the only accessor that returns undefined rather
          // than throwing outside a `withSession` stack — `current` throws
          // NoSessionException and `currentMaybe` throws
          // AsyncLocalStorageNoContextException.
          (this.identity.currentIfInCtx?.userId ?? payload.user)
        : // Updates and deletes are only reachable from authenticated
          // mutations. Throw rather than silently mis-attribute the change to
          // its own subject if that ever stops being true.
          this.identity.current.userId;
    const payloadWithBy = { ...payload, by };
    this.forAllActionChannels(action, payloadWithBy).publish(payloadWithBy);
    return payloadWithBy;
  }

  created(
    args: Omit<UserMutationArgs, 'user'> = {},
  ): Channel<UserMutationPayload> {
    return this.forAction('created', args);
  }

  deleted(args: UserMutationArgs = {}): Channel<UserMutationPayload> {
    return this.forAction('deleted', args);
  }

  updated(args: UserMutationArgs = {}): Channel<
    UserMutationPayload & {
      previous: UserUpdate;
      updated: UserUpdate;
    }
  > {
    return this.forAction('updated', args);
  }

  private forAllActionChannels<T>(
    action: Action,
    payload: UserMutationPayload,
  ): Channel<T> {
    return Composite.for([
      this.forAction(action, { user: payload.user }),
      this.forAction(action, {}),
    ]);
  }

  private forAction<T>(action: Action, args: UserMutationArgs): Channel<T> {
    if (args.user) {
      if (action === 'created') {
        return this.channel([]);
      }
      return this.channel(`user:${args.user}:${action}`);
    }
    return this.channel(`user:${action}`);
  }

  private channel<T>(channels: Many<string>): Channel<T> {
    return Composite.for(
      many(channels).map((name) => this.broadcaster.channel(name)),
    );
  }
}
