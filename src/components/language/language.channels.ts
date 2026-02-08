import { Injectable } from '@nestjs/common';
import { ArgsType } from '@nestjs/graphql';
import { type DateTime } from 'luxon';
import type { SetRequired } from 'type-fest';
import { type ID, IdField } from '~/common';
import { Identity } from '~/core/authentication';
import { type BroadcastChannel, Broadcaster } from '~/core/broadcast';
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
  publishToAll<
    Action extends Exclude<keyof LanguageChannels, 'publishToAll'>,
  >(
    action: Action,
    payload: ReturnType<LanguageChannels[Action]> extends BroadcastChannel<
      infer T extends LanguageMutationPayload
    >
      ? Omit<T, 'by'>
      : never,
  ) {
    const by = this.identity.current.userId;
    const payloadWithBy = { ...payload, by };
    // Note: 'created' doesn't support language-specific channels because
    // the language ID doesn't exist yet when a client subscribes
    if (action !== 'created') {
      this[action]({ language: payload.language }).publish(payloadWithBy);
    }
    this[action]().publish(payloadWithBy);
    return payloadWithBy;
  }

  created(_args: LanguageCreatedArgs = {}) {
    return this.broadcaster.channel<LanguageMutationPayload>(
      `language:created`,
    );
  }

  deleted(args: LanguageMutationArgs = {}) {
    return this.broadcaster.channel<LanguageMutationPayload>(
      args.language
        ? `language:deleted:${args.language}`
        : `language:deleted`,
    );
  }

  updated(args: LanguageMutationArgs = {}) {
    return this.broadcaster.channel<
      LanguageMutationPayload & {
        previous: LanguageUpdate;
        updated: LanguageUpdate;
      }
    >(
      args.language
        ? `language:updated:${args.language}`
        : `language:updated`,
    );
  }
}
