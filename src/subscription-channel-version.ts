import { DateTime } from 'luxon';

/**
 * A versioning point for the mapping between subscriptions and broadcast channels.
 *
 * Update this timestamp whenever the logic that determines which channels
 * a subscription observes is changed.
 *
 * Since we identify a subscription's channels imperatively at runtime, the
 * system cannot automatically detect when this relationship has changed.
 * Updating this version signals the system to re-evaluate and re-bind
 * subscriptions to their appropriate channels.
 */
export const SubscriptionChannelVersion = DateTime.fromSQL('2021-09-01 00:00');
