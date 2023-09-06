import { EventsHandler, GqlContextHost, ResourceLoader } from '~/core';
import { Privileges } from '../../../authorization';
import { CanUpdateMediaUserMetadataEvent } from '../../../file/media/events/can-update-event';
import { ProgressReportMedia as ReportMedia } from '../media.dto';

@EventsHandler(CanUpdateMediaUserMetadataEvent)
export class ProgressReportUpdateMediaMetadataCheckHandler {
  constructor(
    private readonly resources: ResourceLoader,
    private readonly privileges: Privileges,
    private readonly contextHost: GqlContextHost,
  ) {}

  async handle(event: CanUpdateMediaUserMetadataEvent) {
    const attached = await event.getAttachedResource();
    if (!attached.is(ReportMedia)) {
      return;
    }
    const reportMediaId = event.media.attachedTo[0].properties.id;

    const reportMedia = await this.resources.load(ReportMedia, reportMediaId);
    const session = this.contextHost.context.session!;
    const allowed = this.privileges
      .for(session, ReportMedia, reportMedia)
      .can('edit');

    event.allowUpdate.vote(allowed);
  }
}
