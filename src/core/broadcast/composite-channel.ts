// eslint-disable-next-line @seedcompany/no-restricted-imports
import { BroadcastChannel } from '@seedcompany/nest/broadcast';
import { merge, type Observable } from 'rxjs';

export class CompositeChannel<T> extends BroadcastChannel<T> {
  constructor(readonly channels: ReadonlyArray<BroadcastChannel<T>>) {
    super();
  }

  static for<T>(channels: Iterable<BroadcastChannel<T>>): BroadcastChannel<T> {
    const c = [...channels];
    if (c.length === 1) {
      return c[0]!;
    }
    return new CompositeChannel(c);
  }

  static flatten<T>(
    channel: BroadcastChannel<T>,
  ): ReadonlyArray<BroadcastChannel<T>> {
    if (channel instanceof CompositeChannel) {
      return channel.channels.flatMap(CompositeChannel.flatten);
    }
    return [channel];
  }

  static names(channel: BroadcastChannel): readonly string[] {
    return channel instanceof CompositeChannel
      ? channel.names()
      : [channel.name];
  }

  // @ts-expect-error - getter vs property doesn't actually matter
  get name(): never {
    throw new Error('CompositeChannels do not have a singular name.');
  }

  names(): readonly string[] {
    return this.channels.flatMap((channel) =>
      channel instanceof CompositeChannel ? channel.names() : [channel.name],
    );
  }

  observe(): Observable<T> {
    return merge(...this.channels);
  }

  publish(data: T) {
    for (const channel of this.channels) {
      channel.publish(data);
    }
  }
}
