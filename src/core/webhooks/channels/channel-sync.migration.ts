import { SubscriptionChannelVersion } from '../../../subscription-channel-version';
import { BaseMigration, Migration } from '../../database';
import { WebhookChannelRepository } from './webhook-channel.repository';
import { WebhookChannelService } from './webhook-channel.service';

@Migration(SubscriptionChannelVersion)
export class WebhookChannelSyncMigration extends BaseMigration {
  constructor(
    private readonly service: WebhookChannelService,
    private readonly repo: WebhookChannelRepository,
  ) {
    super();
  }

  async up() {
    const webhooks = await this.repo.getStale(this.version);
    if (!webhooks.length) return;
    this.logger.notice('Found webhooks needing channels reevaluated', {
      count: webhooks.length,
    });
    const logProgressPercentage = 0.25;
    for (const [i, webhook] of webhooks.entries()) {
      if (i % Math.floor(1 / logProgressPercentage) === 0) {
        this.logger.notice(
          `Reevaluating channels for webhook ${i + 1}/${webhooks.length}`,
        );
      }
      await this.service.calculate(webhook);
    }
  }
}
