import { BroadcasterTransport } from '@seedcompany/nest/broadcast';
import { EMPTY, type ObservableInput } from 'rxjs';
import type { BroadcastChannel } from '../../broadcast';

export class WebhookStaticEventsTransport extends BroadcasterTransport {
  constructor(
    private readonly eventsByChannel: ReadonlyMap<
      string,
      ObservableInput<unknown>
    >,
  ) {
    super();
  }

  observe(channel: BroadcastChannel) {
    const events = this.eventsByChannel.get(channel.name);
    return events ?? EMPTY;
  }

  publish() {
    throw new Error(
      'You should not be publishing events within a Subscription resolver.',
    );
  }
}
