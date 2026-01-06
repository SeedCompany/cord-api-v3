import { Injectable } from '@nestjs/common';
import { ArgsType } from '@nestjs/graphql';
import type { SetRequired } from 'type-fest';
import { type ID, IdField } from '~/common';
import { type BroadcastChannel, Broadcaster } from '~/core/broadcast';
import { type ProjectChanges } from './dto';

@ArgsType()
export class ProjectChangedArgs {
  @IdField({ nullable: true })
  project?: ID<'Project'>;
}

export type ProjectChangedPayload = SetRequired<
  ProjectChangedArgs,
  keyof ProjectChangedArgs
>;

/**
 * Typed channels for project events.
 */
@Injectable()
export class ProjectChannels {
  constructor(private readonly broadcaster: Broadcaster) {}

  /**
   * Call publish() on the channel action for all arg/filter variations.
   */
  publishToAll<Action extends Exclude<keyof ProjectChannels, 'publishToAll'>>(
    action: Action,
    payload: ReturnType<ProjectChannels[Action]> extends BroadcastChannel<
      infer T extends ProjectChangedPayload
    >
      ? T
      : never,
  ) {
    this[action](payload).publish(payload);
    this[action]().publish(payload);
  }

  created() {
    return this.broadcaster.channel<ProjectChangedPayload>('project:created');
  }

  deleted({ project }: ProjectChangedArgs = {}) {
    return this.broadcaster.channel<ProjectChangedPayload>(
      'project:deleted',
      project,
    );
  }

  updated({ project }: ProjectChangedArgs = {}) {
    return this.broadcaster.channel<
      ProjectChangedPayload & { changes: ProjectChanges }
    >('project:updated', project);
  }
}
