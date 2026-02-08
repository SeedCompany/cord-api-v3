import { OnHook } from '~/core/hooks';
import { PeriodicReportUploadedHook } from '../../periodic-report/hooks';
import { ProductStep } from '../../product/dto';
import { PnpProductSyncService } from '../../product/pnp-product-sync.service';
import { PnpExtractionResultRepository } from './pnp-extraction-result.gel.repository';

@OnHook(PeriodicReportUploadedHook, 1)
export class SaveProgressExtractionResultHandler {
  constructor(
    private readonly repo: PnpExtractionResultRepository,
    private readonly productSyncer: PnpProductSyncService,
  ) {}

  async handle(event: PeriodicReportUploadedHook) {
    if (!event.pnpResultUsed) {
      return;
    }

    // Parse product/goal sync to hydrate problems from that process.
    await this.productSyncer.parse({
      engagementId: event.report.parent.properties.id,
      // Roll with all the steps to get something since we don't have the actual
      // methodology from the user to filter with
      availableSteps: [...ProductStep],
      pnp: event.file,
      result: event.pnpResult,
    });

    await this.repo.save(event.file.id, event.pnpResult);
  }
}
