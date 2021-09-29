import { EventsHandler, IEventHandler } from '../../../core';
import { SecurePeriodicReportEvent } from '../../periodic-report/events';
import { NarrativeReportService } from '../narrative-report.service';

@EventsHandler(SecurePeriodicReportEvent)
export class SecureNarrativeReportHandler
  implements IEventHandler<SecurePeriodicReportEvent>
{
  constructor(private readonly service: NarrativeReportService) {}

  async handle(event: SecurePeriodicReportEvent) {
    // We only handle Narrative Reports
    if (event.report.type !== 'Narrative') {
      return;
    }
    event.secured = await this.service.secure(event.report, event.session);
  }
}
