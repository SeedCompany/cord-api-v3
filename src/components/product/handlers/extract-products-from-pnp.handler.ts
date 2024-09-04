import { EventsHandler, IEventHandler } from '~/core';
import {
  EngagementCreatedEvent,
  EngagementUpdatedEvent,
} from '../../engagement/events';
import { FileService } from '../../file';
import { PnpPlanningExtractionResult } from '../../pnp/extraction-result';
import { getAvailableSteps } from '../dto';
import { PnpProductSyncService } from '../pnp-product-sync.service';

type SubscribedEvent = EngagementCreatedEvent | EngagementUpdatedEvent;

@EventsHandler(EngagementCreatedEvent, EngagementUpdatedEvent)
export class ExtractProductsFromPnpHandler
  implements IEventHandler<SubscribedEvent>
{
  constructor(
    private readonly syncer: PnpProductSyncService,
    private readonly files: FileService,
  ) {}

  async handle(event: SubscribedEvent): Promise<void> {
    if (!event.isLanguageEngagement()) {
      return;
    }
    const engagement =
      event instanceof EngagementCreatedEvent
        ? event.engagement
        : event.updated;
    const { pnp: hasPnpInput, methodology } = event.input;
    if (!engagement.pnp || !hasPnpInput || !methodology) {
      return;
    }
    const availableSteps = getAvailableSteps({ methodology });

    const file = await this.files.getFile(engagement.pnp.id, event.session);
    const fv = await this.files.getFileVersion(
      file.latestVersionId,
      event.session,
    );
    const pnp = this.files.asDownloadable(fv);

    const result = new PnpPlanningExtractionResult(pnp.id);

    const actionableProductRows = await this.syncer.parse({
      engagementId: engagement.id,
      availableSteps,
      pnp,
      result,
    });

    await this.syncer.save({
      engagementId: engagement.id,
      methodology,
      actionableProductRows,
      session: event.session,
    });
  }
}
