import { EventsHandler, ResourceLoader } from '~/core';
import { Privileges } from '../../../authorization';
import { CanUpdateMediaUserMetadataEvent } from '../../../file/media/events/can-update-event';
import { ProgressReportMedia as ReportMedia } from '../dto';

@EventsHandler(CanUpdateMediaUserMetadataEvent)
export class ProgressReportUpdateMediaMetadataCheckHandler {
  constructor(
    private readonly resources: ResourceLoader,
    private readonly privileges: Privileges,
  ) {}

  async handle(event: CanUpdateMediaUserMetadataEvent) {
    const attached = event.getAttachedResource();
    if (!attached.is(ReportMedia)) {
      return;
    }
    const reportMediaId = event.media.attachedTo[0].properties.id;

    const reportMedia = await this.resources.load(ReportMedia, reportMediaId);
    const allowed = this.privileges.for(ReportMedia, reportMedia).can('edit');

    event.allowUpdate.vote(this, allowed);
  }
}
