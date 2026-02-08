import { OnHook, ResourceLoader } from '~/core';
import { Privileges } from '../../../authorization';
import { CanUpdateMediaUserMetadataHook } from '../../../file/media/hooks/can-update.hook';
import { ProgressReportMedia as ReportMedia } from '../dto';

@OnHook(CanUpdateMediaUserMetadataHook)
export class ProgressReportUpdateMediaMetadataCheckHandler {
  constructor(
    private readonly resources: ResourceLoader,
    private readonly privileges: Privileges,
  ) {}

  async handle(event: CanUpdateMediaUserMetadataHook) {
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
