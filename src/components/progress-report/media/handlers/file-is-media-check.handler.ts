import { InputException } from '~/common';
import { ResourceLoader, ResourceResolver } from '~/core';
import { OnHook } from '~/core/hooks';
import { AfterFileUploadHook } from '../../../file/hooks/after-file-upload.hook';
import { MediaByFileVersionLoader } from '../../../file/media/media-by-file-version.loader';

@OnHook(AfterFileUploadHook)
export class ProgressReportMediaFileIsMediaCheckHandler {
  constructor(
    private readonly resourceResolver: ResourceResolver,
    private readonly resources: ResourceLoader,
  ) {}

  async handle({ file }: AfterFileUploadHook) {
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
