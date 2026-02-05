import { Injectable } from '@nestjs/common';
import { ArgsType } from '@nestjs/graphql';
import { type DateTime } from 'luxon';
import type { SetRequired } from 'type-fest';
import { type ID, IdField } from '~/common';
import { Identity } from '~/core/authentication';
import { type BroadcastChannel, Broadcaster } from '~/core/broadcast';
import {
  type InternshipEngagementUpdate,
  type LanguageEngagementUpdate,
} from './dto';

@ArgsType()
export class EngagementCreatedArgs {
  @IdField({ nullable: true })
  project?: ID<'Project'>;
}

@ArgsType()
export class EngagementMutationArgs extends EngagementCreatedArgs {
  @IdField({ nullable: true })
  engagement?: ID<'Engagement'>;
}

export type EngagementMutationPayload = SetRequired<
  EngagementMutationArgs,
  keyof EngagementMutationArgs
> & {
  at: DateTime;
  by: ID<'User'>;
};

export type LanguageEngagementMutationPayload = EngagementMutationPayload;

export type InternshipEngagementMutationPayload = EngagementMutationPayload;

/**
 * Typed channels for engagement events.
 */
@Injectable()
export class EngagementChannels {
  constructor(
    private readonly identity: Identity,
    private readonly broadcaster: Broadcaster,
  ) {}

  /**
   * Call publish() on the channel action for all arg/filter variations.
   */
  publishToAll<
    Action extends Exclude<keyof EngagementChannels, 'publishToAll'>,
  >(
    action: Action,
    payload: ReturnType<EngagementChannels[Action]> extends BroadcastChannel<
      infer T extends EngagementMutationPayload
    >
      ? Omit<T, 'by'>
      : never,
  ) {
    const by = this.identity.current.userId;
    const payloadWithBy = { ...payload, by };
    if (action !== 'languageCreated' && action !== 'internshipCreated') {
      this[action]({ engagement: payload.engagement }).publish(payloadWithBy);
    }
    this[action]({ project: payload.project }).publish(payloadWithBy);
    this[action]().publish(payloadWithBy);
    return payloadWithBy;
  }

  languageCreated(args: EngagementCreatedArgs = {}) {
    return this.broadcaster.channel<LanguageEngagementMutationPayload>(
      `project:${args.project ?? 'any'}:engagement:language:created`,
    );
  }

  internshipCreated(args: EngagementCreatedArgs = {}) {
    return this.broadcaster.channel<InternshipEngagementMutationPayload>(
      `project:${args.project ?? 'any'}:engagement:internship:created`,
    );
  }

  languageUpdated(args: EngagementMutationArgs = {}) {
    return this.broadcaster.channel<
      LanguageEngagementMutationPayload & {
        previous: LanguageEngagementUpdate;
        updated: LanguageEngagementUpdate;
      }
    >(
      args.engagement
        ? `engagement:language:updated:${args.engagement}`
        : `project:${args.project ?? 'any'}:engagement:language:updated`,
    );
  }

  internshipUpdated(args: EngagementMutationArgs = {}) {
    return this.broadcaster.channel<
      InternshipEngagementMutationPayload & {
        previous: InternshipEngagementUpdate;
        updated: InternshipEngagementUpdate;
      }
    >(
      args.engagement
        ? `engagement:internship:updated:${args.engagement}`
        : `project:${args.project ?? 'any'}:engagement:internship:updated`,
    );
  }

  languageDeleted(args: EngagementMutationArgs = {}) {
    return this.broadcaster.channel<EngagementMutationPayload>(
      args.engagement
        ? `engagement:language:deleted:${args.engagement}`
        : `project:${args.project ?? 'any'}:engagement:language:deleted`,
    );
  }

  internshipDeleted(args: EngagementMutationArgs = {}) {
    return this.broadcaster.channel<EngagementMutationPayload>(
      args.engagement
        ? `engagement:internship:deleted:${args.engagement}`
        : `project:${args.project ?? 'any'}:engagement:internship:deleted`,
    );
  }
}
