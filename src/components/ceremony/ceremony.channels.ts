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
import { type CeremonyUpdate } from './dto';

@ArgsType()
export class CeremonyCreatedArgs {}

@ArgsType()
export class CeremonyMutationArgs {
  @IdField({ nullable: true })
  ceremony?: ID<'Ceremony'>;
}

export type CeremonyMutationPayload = SetRequired<
  CeremonyMutationArgs,
  keyof CeremonyMutationArgs
> & {
  at: DateTime;
  by: ID<'Actor'>;
};

type Action = 'created' | 'updated' | 'deleted';

/**
 * Typed channels for ceremony events.
 */
@Injectable()
export class CeremonyChannels {
  constructor(
    private readonly identity: Identity,
    private readonly broadcaster: Broadcaster,
  ) {}

  /**
   * Call publish() on the channel action for all arg/filter variations.
   */
  publishToAll<Action extends Exclude<keyof CeremonyChannels, 'publishToAll'>>(
    action: Action,
    payload: ReturnType<CeremonyChannels[Action]> extends Channel<
      infer T extends CeremonyMutationPayload
    >
      ? Omit<T, 'by'>
      : never,
  ) {
    const by = this.identity.current.userId;
    const payloadWithBy = { ...payload, by };
    this.forAllActionChannels(action, payloadWithBy).publish(payloadWithBy);
    return payloadWithBy;
  }

  created(
    args: Omit<CeremonyMutationArgs, 'ceremony'> = {},
  ): Channel<CeremonyMutationPayload> {
    return this.forAction('created', args);
  }

  deleted(args: CeremonyMutationArgs = {}): Channel<CeremonyMutationPayload> {
    return this.forAction('deleted', args);
  }

  updated(args: CeremonyMutationArgs = {}): Channel<
    CeremonyMutationPayload & {
      previous: CeremonyUpdate;
      updated: CeremonyUpdate;
    }
  > {
    return this.forAction('updated', args);
  }

  private forAllActionChannels<T>(
    action: Action,
    payload: CeremonyMutationPayload,
  ): Channel<T> {
    return Composite.for([
      this.forAction(action, { ceremony: payload.ceremony }),
      this.forAction(action, {}),
    ]);
  }

  private forAction<T>(action: Action, args: CeremonyMutationArgs): Channel<T> {
    if (args.ceremony) {
      if (action === 'created') {
        return this.channel([]);
      }
      return this.channel(`ceremony:${args.ceremony}:${action}`);
    }
    return this.channel(`ceremony:${action}`);
  }

  private channel<T>(channels: Many<string>): Channel<T> {
    return Composite.for(
      many(channels).map((name) => this.broadcaster.channel(name)),
    );
  }
}
