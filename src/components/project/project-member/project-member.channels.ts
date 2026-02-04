import { Injectable } from '@nestjs/common';
import { ArgsType } from '@nestjs/graphql';
import { type DateTime } from 'luxon';
import type { SetRequired } from 'type-fest';
import { type ID, IdField } from '~/common';
import { Identity } from '~/core/authentication';
import { type BroadcastChannel, Broadcaster } from '~/core/broadcast';
import { type ProjectMemberUpdate } from './dto';

@ArgsType()
export class ProjectMemberCreatedArgs {
  @IdField({ nullable: true })
  project?: ID<'Project'>;
}

@ArgsType()
export class ProjectMemberMutationArgs extends ProjectMemberCreatedArgs {
  @IdField({ nullable: true })
  member?: ID<'ProjectMember'>;
}

export type ProjectMemberMutationPayload = SetRequired<
  ProjectMemberMutationArgs,
  keyof ProjectMemberMutationArgs
> & {
  at: DateTime;
  by: ID<'User'>;
};

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
  publishToAll<
    Action extends Exclude<keyof ProjectMemberChannels, 'publishToAll'>,
  >(
    action: Action,
    payload: ReturnType<ProjectMemberChannels[Action]> extends BroadcastChannel<
      infer T extends ProjectMemberMutationPayload
    >
      ? Omit<T, 'by'>
      : never,
  ) {
    const by = this.identity.current.userId;
    const payloadWithBy = { ...payload, by };
    if (action !== 'created') {
      this[action]({ member: payload.member }).publish(payloadWithBy);
    }
    this[action]({ project: payload.project }).publish(payloadWithBy);
    this[action]().publish(payloadWithBy);
    return payloadWithBy;
  }

  created(args: ProjectMemberCreatedArgs = {}) {
    return this.broadcaster.channel<ProjectMemberMutationPayload>(
      `project:${args.project ?? 'any'}:member:created`,
    );
  }

  deleted(args: ProjectMemberMutationArgs = {}) {
    return this.broadcaster.channel<ProjectMemberMutationPayload>(
      args.member
        ? `project:member:deleted:${args.member}`
        : `project:${args.project ?? 'any'}:member:deleted`,
    );
  }

  updated(args: ProjectMemberMutationArgs = {}) {
    return this.broadcaster.channel<
      ProjectMemberMutationPayload & {
        previous: ProjectMemberUpdate;
        updated: ProjectMemberUpdate;
      }
    >(
      args.member
        ? `project:member:updated:${args.member}`
        : `project:${args.project ?? 'any'}:member:updated`,
    );
  }
}
