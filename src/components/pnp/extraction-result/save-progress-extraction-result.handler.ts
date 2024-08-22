import { EventsHandler } from '~/core';
import { PeriodicReportUploadedEvent } from '../../periodic-report/events';
import { PnpExtractionResultRepository } from './pnp-extraction-result.edgedb.repository';

@EventsHandler([PeriodicReportUploadedEvent, -1])
export class SaveProgressExtractionResultHandler {
  constructor(private readonly repo: PnpExtractionResultRepository) {}

  async handle(event: PeriodicReportUploadedEvent) {
    if (!event.pnpResultUsed) {
      return;
    }

    await this.repo.save(event.file.id, event.pnpResult);
  }
}
