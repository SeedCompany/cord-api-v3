import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { Loader, LoaderOf } from '@seedcompany/data-loader';
import { FileVersion } from '../dto';
import { FileNodeLoader } from '../file-node.loader';
import { Media } from './media.dto';

@Resolver(() => Media)
export class MediaResolver {
  @ResolveField(() => FileVersion)
  async file(
    @Parent() media: Media,
    @Loader(FileNodeLoader) files: LoaderOf<FileNodeLoader>,
  ) {
    return await files.load(media.file);
  }
}
