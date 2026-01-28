// eslint-disable-next-line @seedcompany/no-restricted-imports
import { type BroadcastChannel as Channel } from '@seedcompany/nest/broadcast';

const state = new WeakSet<Channel>();

/**
 * Mark this broadcast channel as internal and should not be considered
 * for user facing events like webhooks.
 */
export const internal = <TChannel extends Channel>(channel: TChannel) => {
  state.add(channel);
  return channel;
};
internal.is = (channel: Channel) => state.has(channel);
