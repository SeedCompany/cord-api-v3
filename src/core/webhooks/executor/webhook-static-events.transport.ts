import { BroadcasterTransport } from '@seedcompany/nest/broadcast';
import { type ObservableInput } from 'rxjs';
import { type BroadcastChannel, CompositeChannel } from '../../broadcast';

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
    return CompositeChannel.names(channel).flatMap((name) => {
      const events = this.eventsByChannel.get(name);
      return events ?? [];
    });
  }

  publish() {
    throw new Error(
      'You should not be publishing events within a Subscription resolver.',
    );
  }
}
