import { Injectable } from '@nestjs/common';
import { ArgsType } from '@nestjs/graphql';
import { type DateTime } from 'luxon';
import type { SetRequired } from 'type-fest';
import { type ID, IdField } from '~/common';
import { Identity } from '~/core/authentication';
import { type BroadcastChannel, Broadcaster } from '~/core/broadcast';
import { type ProjectUpdate } from './dto';

@ArgsType()
export class ProjectMutationArgs {
  @IdField({ nullable: true })
  project?: ID<'Project'>;
}

export type ProjectMutationPayload = SetRequired<
  ProjectMutationArgs,
  keyof ProjectMutationArgs
> & {
  at: DateTime;
  by: ID<'User'>;
};

/**
 * Typed channels for project events.
 */
@Injectable()
export class ProjectChannels {
  constructor(
    private readonly identity: Identity,
    private readonly broadcaster: Broadcaster,
  ) {}

  /**
   * Call publish() on the channel action for all arg/filter variations.
   */
  publishToAll<Action extends Exclude<keyof ProjectChannels, 'publishToAll'>>(
    action: Action,
    payload: ReturnType<ProjectChannels[Action]> extends BroadcastChannel<
      infer T extends ProjectMutationPayload
    >
      ? Omit<T, 'by'>
      : never,
  ) {
    const by = this.identity.current.userId;
    const payloadWithBy = { ...payload, by };
    this[action](payload).publish(payloadWithBy);
    this[action]().publish(payloadWithBy);
    return payloadWithBy;
  }

  created() {
    return this.broadcaster.channel<ProjectMutationPayload>('project:created');
  }

  deleted({ project }: ProjectMutationArgs = {}) {
    return this.broadcaster.channel<ProjectMutationPayload>(
      'project:deleted',
      project,
    );
  }

  updated({ project }: ProjectMutationArgs = {}) {
    return this.broadcaster.channel<
      ProjectMutationPayload & {
        previous: ProjectUpdate;
        updated: ProjectUpdate;
      }
    >('project:updated', project);
  }
}
