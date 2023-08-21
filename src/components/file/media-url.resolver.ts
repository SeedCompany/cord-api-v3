import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { Loader, LoaderOf } from '@seedcompany/data-loader';
import { stripIndent } from 'common-tags';
import { URL } from 'url';
import { FileNodeLoader } from './file-node.loader';
import { FileService } from './file.service';
import { Media } from './media/media.dto';

@Resolver(() => Media)
export class MediaUrlResolver {
  constructor(protected readonly service: FileService) {}

  @ResolveField(() => URL, {
    description: stripIndent`
      A url to the file version.

      This url could require authentication.
    `,
  })
  async url(
    @Parent() media: Media,
    @Loader(FileNodeLoader) files: LoaderOf<FileNodeLoader>,
  ) {
    const node = await files.load(media.file);
    return await this.service.getUrl(node);
  }
}
