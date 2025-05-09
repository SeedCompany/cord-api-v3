import {
  Args,
  Mutation,
  Parent,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { Loader, type LoaderOf } from '@seedcompany/data-loader';
import { type ID, IdArg } from '~/common';
import { FileVersion } from '../dto';
import { FileNodeLoader } from '../file-node.loader';
import { type AnyMedia, Media, MediaUserMetadata } from './media.dto';
import { MediaService } from './media.service';

@Resolver(() => Media)
export class MediaResolver {
  constructor(private readonly service: MediaService) {}

  @ResolveField(() => FileVersion)
  async file(
    @Parent() media: Media,
    @Loader(FileNodeLoader) files: LoaderOf<FileNodeLoader>,
  ) {
    return await files.load(media.file);
  }

  @Mutation(() => Media, {
    description: 'Update the media metadata',
  })
  updateMediaMetadata(
    @IdArg({ description: 'The Media ID' }) id: ID,
    @Args('metadata') input: MediaUserMetadata,
  ): Promise<AnyMedia> {
    return this.service.updateUserMetadata({
      id,
      ...input,
    });
  }
}
