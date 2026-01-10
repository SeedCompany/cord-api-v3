import { BroadcasterTransport } from '@seedcompany/nest/broadcast';
import { EMPTY } from 'rxjs';
import type { BroadcastChannel } from '../../broadcast';

export class WebhookCollectChannelsTransport extends BroadcasterTransport {
  readonly channels = new Set<string>();

  observe(channel: BroadcastChannel) {
    this.channels.add(channel.name);
    return EMPTY;
  }

  publish() {
    throw new Error(
      'You should not be publishing events within a Subscription resolver.',
    );
  }
}
