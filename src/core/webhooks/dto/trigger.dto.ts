import { DateTime } from 'luxon';
import { randomUUID } from 'node:crypto';
import { type ID } from '~/common';

/**
 * This represents a source that triggered the webhook(s)
 * It is meant to be shared across all webhooks and multiple emissions from
 * a broadcasted event.
 *
 * It is only used on our side for telemetry
 * and potentially useful on the consumer's side.
 */
export class WebhookTrigger {
  constructor(
    //
    readonly id = randomUUID() as ID,
    readonly at = DateTime.now(),
  ) {}
}
