import { BroadcasterTransport } from '@seedcompany/nest/broadcast';
import { defer, mergeMap } from 'rxjs';
import { type Hooks } from '~/core/hooks';
import { BroadcastObservedHook, BroadcastPublishedHook } from './hooks';
import type { BroadcastChannel } from './index';

export class HookedTransport extends BroadcasterTransport {
  constructor(
    private readonly transport: BroadcasterTransport,
    private readonly hooks: Hooks,
  ) {
    super();
  }

  observe(channel: BroadcastChannel) {
    const stream = this.transport.observe(channel);
    return defer(() =>
      this.hooks.run(new BroadcastObservedHook(channel, stream)),
    ).pipe(mergeMap((hook) => hook.stream));
  }

  publish(channel: BroadcastChannel, data: unknown) {
    this.transport.publish(channel, data);
    void this.hooks.run(new BroadcastPublishedHook(channel, data));
  }
}
