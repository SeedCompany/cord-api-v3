import {
  Inject,
  Injectable,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { DateTime } from 'luxon';
import { ConfigService } from '~/core/config';
import { ILogger, Logger } from '~/core/logger';
import { SubscriptionChannelVersion } from '../../../subscription-channel-version';
import { WebhookTrigger } from '../dto';
import { WebhookChannelRepository } from './webhook-channel.repository';
import { WebhookChannelService } from './webhook-channel.service';

/**
 * At boot, re-evaluate the channels of every webhook last evaluated before the
 * current `SubscriptionChannelVersion`, so a deploy that changes how channels
 * are derived catches existing webhooks up.
 *
 * Idempotent: a recalculated webhook is no longer stale, so the next boot finds
 * nothing. Runs after module init, so after the Postgres migrations. Like the
 * root-object setup in AdminService, it runs in the background (awaited only
 * under jest) so it never holds up or fails the server's startup.
 */
@Injectable()
export class WebhookChannelSync implements OnApplicationBootstrap {
  @Logger('webhooks:channel-sync') private readonly logger: ILogger;

  constructor(
    private readonly service: WebhookChannelService,
    private readonly repo: WebhookChannelRepository,
    private readonly config: ConfigService,
    @Inject(SubscriptionChannelVersion.TOKEN)
    private readonly version: DateTime,
  ) {}

  async onApplicationBootstrap() {
    // No database in schema generation, no writes in read-only mode, and a
    // console/repl session is not a deploy.
    if (
      this.config.isGenSchema ||
      this.config.maintenance.readOnly ||
      this.config.isCli
    ) {
      return;
    }
    const syncing = this.sync();
    if (this.config.jest) {
      await syncing;
    } else {
      syncing.catch((exception) => {
        this.logger.error('Failed to sync webhook channels', { exception });
      });
    }
  }

  async sync() {
    const webhooks = await this.repo.getStale(this.version);
    if (!webhooks.length) return;
    this.logger.notice('Found webhooks needing channels reevaluated', {
      count: webhooks.length,
    });
    const trigger = new WebhookTrigger();
    const logProgressPercentage = 0.25;
    for (const [i, webhook] of webhooks.entries()) {
      if (i % Math.floor(1 / logProgressPercentage) === 0) {
        this.logger.notice(
          `Reevaluating channels for webhook ${i + 1}/${webhooks.length}`,
        );
      }
      try {
        await this.service.recalculate(webhook, trigger);
      } catch (exception) {
        // One webhook failing should not stop the rest. It stays stale, so the
        // next boot retries it.
        this.logger.error('Failed to reevaluate webhook channels', {
          webhook: webhook.id,
          exception,
        });
      }
    }
  }
}
