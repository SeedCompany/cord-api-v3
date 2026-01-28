import { type BroadcastChannel } from '~/core/broadcast';

export class BroadcastPublishedHook {
  constructor(
    readonly channel: BroadcastChannel,
    readonly data: unknown,
  ) {}
}
