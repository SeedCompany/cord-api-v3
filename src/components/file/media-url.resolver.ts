import { Parent, Resolver } from '@nestjs/graphql';
import { Loader, LoaderOf } from '@seedcompany/data-loader';
import { FileNodeLoader } from './file-node.loader';
import * as FileUrl from './file-url.resolver-util';
import { FileService } from './file.service';
import { Media } from './media/media.dto';

@Resolver(() => Media)
export class MediaUrlResolver {
  constructor(protected readonly service: FileService) {}

  @FileUrl.Resolver()
  async url(
    @Parent() media: Media,
    @FileUrl.DownloadArg() download: boolean,
    @Loader(FileNodeLoader) files: LoaderOf<FileNodeLoader>,
  ) {
    const node = await files.load(media.file);
    return await this.service.getUrl(node, download);
  }
}
