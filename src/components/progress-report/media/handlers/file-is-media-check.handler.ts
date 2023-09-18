import { InputException } from '~/common';
import { EventsHandler, ResourceLoader, ResourceResolver } from '~/core';
import { AfterFileUploadEvent } from '../../../file/events/after-file-upload.event';
import { MediaByFileVersionLoader } from '../../../file/media/media-by-file-version.loader';

@EventsHandler(AfterFileUploadEvent)
export class ProgressReportMediaFileIsMediaCheckHandler {
  constructor(
    private readonly resourceResolver: ResourceResolver,
    private readonly resources: ResourceLoader,
  ) {}

  async handle({ file }: AfterFileUploadEvent) {
    const [resource] = file.rootAttachedTo;
    const resType = this.resourceResolver.resolveTypeByBaseNode(resource);
    if (resType !== 'ProgressReportMedia') {
      return;
    }

    const mediaByFv = await this.resources.getLoader(MediaByFileVersionLoader);
    try {
      await mediaByFv.load(file.latestVersionId);
    } catch (e) {
      throw new InputException(
        'File does not appear to be a media file',
        'file',
      );
    }
  }
}
