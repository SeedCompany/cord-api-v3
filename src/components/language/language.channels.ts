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
import { type ProjectChannels } from '../project/project.channels';
import { type LanguageUpdate } from './dto';

@ArgsType()
export class LanguageCreatedArgs {}

@ArgsType()
export class LanguageMutationArgs {
  @IdField({ nullable: true })
  language?: ID<'Language'>;
}

export type LanguageMutationPayload = SetRequired<
  LanguageMutationArgs,
  keyof LanguageMutationArgs
> & {
  at: DateTime;
  by: ID<'Actor'>;
};

type Action = keyof Pick<ProjectChannels, 'created' | 'updated' | 'deleted'>;

/**
 * Typed channels for language events.
 */
@Injectable()
export class LanguageChannels {
  constructor(
    private readonly identity: Identity,
    private readonly broadcaster: Broadcaster,
  ) {}

  /**
   * Call publish() on the channel action for all arg/filter variations.
   */
  publishToAll<Action extends Exclude<keyof LanguageChannels, 'publishToAll'>>(
    action: Action,
    payload: ReturnType<LanguageChannels[Action]> extends Channel<
      infer T extends LanguageMutationPayload
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
    args: Omit<LanguageMutationArgs, 'language'> = {},
  ): Channel<LanguageMutationPayload> {
    return this.forAction('created', args);
  }

  deleted(args: LanguageMutationArgs = {}): Channel<LanguageMutationPayload> {
    return this.forAction('deleted', args);
  }

  updated(args: LanguageMutationArgs = {}): Channel<
    LanguageMutationPayload & {
      previous: LanguageUpdate;
      updated: LanguageUpdate;
    }
  > {
    return this.forAction('updated', args);
  }

  private forAllActionChannels<T>(
    action: Action,
    payload: LanguageMutationPayload,
  ): Channel<T> {
    return Composite.for([
      this.forAction(action, { language: payload.language }),
      this.forAction(action, {}),
    ]);
  }

  private forAction<T>(action: Action, args: LanguageMutationArgs): Channel<T> {
    if (args.language) {
      if (action === 'created') {
        return this.channel([]);
      }
      return this.channel(`language:${args.language}:${action}`);
    }
    return this.channel(`language:${action}`);
  }

  private channel<T>(channels: Many<string>): Channel<T> {
    return Composite.for(
      many(channels).map((name) => this.broadcaster.channel(name)),
    );
  }
}
