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
} from '../project.channels';
import { type ProjectMemberUpdate } from './dto';

@ArgsType()
export class ProjectMemberCreatedArgs extends ProjectMutationArgs {}

@ArgsType()
export class ProjectMemberMutationArgs extends ProjectMemberCreatedArgs {
  @IdField({ nullable: true })
  member?: ID<'ProjectMember'>;
}

export type ProjectMemberMutationPayload = ProjectMutationPayload &
  AllRequired<ProjectMemberMutationArgs>;

type Action = keyof Pick<
  ProjectMemberChannels,
  'created' | 'updated' | 'deleted'
>;

/**
 * Typed channels for project member events.
 */
@Injectable()
export class ProjectMemberChannels {
  constructor(
    private readonly identity: Identity,
    private readonly broadcaster: Broadcaster,
  ) {}

  /**
   * Call publish() on the channel action for all arg/filter variations.
   */
  publishToAll<TAction extends Action>(
    action: TAction,
    payload: ReturnType<ProjectMemberChannels[TAction]> extends Channel<
      infer T extends ProjectMemberMutationPayload
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
    args: ProjectMemberCreatedArgs = {},
  ): Channel<ProjectMemberMutationPayload> {
    return this.forAction('created', args);
  }

  deleted(
    args: ProjectMemberMutationArgs = {},
  ): Channel<ProjectMemberMutationPayload> {
    return this.forAction('deleted', args);
  }

  updated(args: ProjectMemberMutationArgs = {}): Channel<
    ProjectMemberMutationPayload & {
      previous: ProjectMemberUpdate;
      updated: ProjectMemberUpdate;
    }
  > {
    return this.forAction('updated', args);
  }

  private forAllActionChannels<T>(
    action: Action,
    payload: ProjectMemberMutationPayload,
  ): Channel<T> {
    return Composite.for([
      this.forAction(action, { member: payload.member }),
      this.forAction(action, { project: payload.project }),
      this.forAction(action, { program: payload.program }),
      this.forAction(action, {}),
    ]);
  }

  private forAction<T>(
    action: Action,
    args: ProjectMemberMutationArgs,
  ): Channel<T> {
    if (args.member) {
      if (action === 'created') {
        return this.channel([]);
      }
      return this.channel(`project-member:${args.member}:${action}`);
    }
    if (args.project) {
      return this.channel(`project:${args.project}:member:${action}`);
    }
    if (args.program?.length) {
      const programs = many(args.program);
      return this.channel(
        programs.map(
          (program) =>
            `program:${Case.kebab(program)}:project-member:${action}`,
        ),
      );
    }
    return this.channel(`project-member:${action}`);
  }

  private channel<T>(channels: Many<string>): Channel<T> {
    return Composite.for(
      many(channels).map((name) => this.broadcaster.channel(name)),
    );
  }
}
