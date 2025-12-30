import { Injectable } from '@nestjs/common';
import { type ID } from '~/common';
import { Broadcaster } from '~/core/broadcast';

/**
 * Typed channels for project events.
 */
@Injectable()
export class ProjectChannels {
  constructor(private readonly broadcaster: Broadcaster) {}

  /**
   * Call publish() on the channel action for all arg/filter variations.
   */
  publishToAll(
    action: Exclude<keyof ProjectChannels, 'publishToAll'>,
    id: ID<'Project'>,
  ) {
    this[action](id).publish(id);
    this[action]().publish(id);
  }

  created() {
    return this.broadcaster.channel<ID<'Project'>>('project:created');
  }
  deleted(id?: ID<'Project'>) {
    return this.broadcaster.channel<ID<'Project'>>('project:deleted', id);
  }
  updated(id?: ID<'Project'>) {
    return this.broadcaster.channel<ID<'Project'>>('project:updated', id);
  }
}
