import { Injectable } from '@nestjs/common';
import { ArgsType } from '@nestjs/graphql';
import { type Many, many } from '@seedcompany/common';
import { Case } from '@seedcompany/common/case';
import { type AllRequired, type ID, IdField } from '~/common';
import { Identity } from '~/core/authentication';
import {
  Broadcaster,
  type BroadcastChannel as Channel,
  CompositeChannel as Composite,
} from '~/core/broadcast';
import {
  ProjectMutationArgs,
  type ProjectMutationPayload,
} from '../project/project.channels';
import {
  type InternshipEngagementUpdate,
  type LanguageEngagementUpdate,
} from './dto';

@ArgsType()
export class EngagementCreatedArgs extends ProjectMutationArgs {}

@ArgsType()
export class EngagementMutationArgs extends EngagementCreatedArgs {
  @IdField({ nullable: true })
  engagement?: ID<'Engagement'>;
}

export type EngagementMutationPayload = ProjectMutationPayload &
  AllRequired<EngagementMutationArgs>;

export type LanguageEngagementMutationPayload = EngagementMutationPayload;

export type InternshipEngagementMutationPayload = EngagementMutationPayload;

type Type = 'language' | 'internship';
type Action = 'created' | 'updated' | 'deleted';

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
    TType extends Type,
    TAction extends Action,
    Method extends `${TType}${Case.UpperFirst<TAction>}`,
  >(
    type: TType,
    action: TAction,
    payload: ReturnType<EngagementChannels[Method]> extends Channel<
      infer T extends EngagementMutationPayload
    >
      ? Omit<T, 'by'>
      : never,
  ) {
    const by = this.identity.current.userId;
    const payloadWithBy = { ...payload, by };
    this.forAllActionChannels(type, action, payloadWithBy).publish(
      payloadWithBy,
    );
    return payloadWithBy;
  }

  languageCreated(
    args: EngagementCreatedArgs = {},
  ): Channel<LanguageEngagementMutationPayload> {
    return this.forAction('language', 'created', args);
  }

  internshipCreated(
    args: EngagementCreatedArgs = {},
  ): Channel<InternshipEngagementMutationPayload> {
    return this.forAction('internship', 'created', args);
  }

  languageUpdated(args: EngagementMutationArgs = {}): Channel<
    LanguageEngagementMutationPayload & {
      previous: LanguageEngagementUpdate;
      updated: LanguageEngagementUpdate;
    }
  > {
    return this.forAction('language', 'updated', args);
  }

  internshipUpdated(args: EngagementMutationArgs = {}): Channel<
    InternshipEngagementMutationPayload & {
      previous: InternshipEngagementUpdate;
      updated: InternshipEngagementUpdate;
    }
  > {
    return this.forAction('internship', 'updated', args);
  }

  languageDeleted(
    args: EngagementMutationArgs = {},
  ): Channel<EngagementMutationPayload> {
    return this.forAction('language', 'deleted', args);
  }

  internshipDeleted(
    args: EngagementMutationArgs = {},
  ): Channel<EngagementMutationPayload> {
    return this.forAction('internship', 'deleted', args);
  }

  private forAllActionChannels<T>(
    type: Type,
    action: Action,
    payload: EngagementMutationPayload,
  ): Channel<T> {
    return Composite.for([
      this.forAction(type, action, { engagement: payload.engagement }),
      this.forAction(type, action, { project: payload.project }),
      this.forAction(type, action, { program: payload.program }),
      this.forAction(type, action, {}),
    ]);
  }

  private forAction<T>(
    type: Type,
    action: Action,
    args: EngagementMutationArgs,
  ): Channel<T> {
    if (args.engagement) {
      if (action === 'created') {
        return this.channel([]);
      }
      return this.channel(`${type}-engagement:${args.engagement}:${action}`);
    }
    if (args.project) {
      return this.channel(
        `project:${args.project}:${type}-engagement:${action}`,
      );
    }
    if (args.program?.length) {
      const programs = many(args.program);
      return this.channel(
        programs.map(
          (program) =>
            `program:${Case.kebab(program)}:${type}-engagement:${action}`,
        ),
      );
    }
    return this.channel(`${type}-engagement:${action}`);
  }

  private channel<T>(channels: Many<string>): Channel<T> {
    return Composite.for(
      many(channels).map((name) => this.broadcaster.channel(name)),
    );
  }
}
