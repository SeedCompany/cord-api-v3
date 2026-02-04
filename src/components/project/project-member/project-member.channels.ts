import { Injectable } from '@nestjs/common';
import { ArgsType } from '@nestjs/graphql';
import { type DateTime } from 'luxon';
import type { SetRequired } from 'type-fest';
import { type ID, IdField } from '~/common';
import { Identity } from '~/core/authentication';
import { type BroadcastChannel, Broadcaster } from '~/core/broadcast';
import { type ProjectMemberUpdate } from './dto';

@ArgsType()
export class ProjectMemberMutationArgs {
  @IdField({ nullable: true })
  projectMember?: ID<'ProjectMember'>;
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
      this[action](payload).publish(payloadWithBy);
    }
    this[action]().publish(payloadWithBy);
    return payloadWithBy;
  }

  created() {
    return this.broadcaster.channel<ProjectMemberMutationPayload>(
      'projectMember:created',
    );
  }

  deleted({ projectMember }: ProjectMemberMutationArgs = {}) {
    return this.broadcaster.channel<ProjectMemberMutationPayload>(
      'projectMember:deleted',
      projectMember,
    );
  }

  updated({ projectMember }: ProjectMemberMutationArgs = {}) {
    return this.broadcaster.channel<
      ProjectMemberMutationPayload & {
        previous: ProjectMemberUpdate;
        updated: ProjectMemberUpdate;
      }
    >('projectMember:updated', projectMember);
  }
}
