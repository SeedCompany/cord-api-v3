import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { AnonSession, Session } from '~/common';
import { Loader, LoaderOf } from '~/core';
import { UserLoader } from '../user';
import { User } from '../user/dto';
import { FileNode, IFileNode, isDirectory } from './dto';
import { FileService } from './file.service';
import { MediaByFileVersionLoader } from './media/media-by-file-version.loader';
import { Media } from './media/media.dto';

@Resolver(IFileNode)
export class FileNodeResolver {
  constructor(protected readonly service: FileService) {}

  @ResolveField(() => User, {
    description: stripIndent`
      The user who created this node.
      For files, this is the user who uploaded the first version of the file.
    `,
  })
  async createdBy(
    @Parent() node: FileNode,
    @Loader(UserLoader) users: LoaderOf<UserLoader>,
  ): Promise<User> {
    return await users.load(node.createdById);
  }

  @ResolveField(() => [IFileNode], {
    description: stripIndent`
        A list of the parents all the way up the tree.
        This can be used to populate a path-like UI,
        without having to fetch each parent serially.
      `,
  })
  async parents(
    @Parent() node: FileNode,
    @AnonSession() _session: Session,
  ): Promise<readonly FileNode[]> {
    return await this.service.getParents(node.id);
  }

  @ResolveField(() => Media, {
    nullable: true,
  })
  async media(
    @Parent() node: FileNode,
    @Loader(() => MediaByFileVersionLoader)
    loader: LoaderOf<MediaByFileVersionLoader>,
  ): Promise<Media | null> {
    if (isDirectory(node)) return null;
    const id = node.latestVersionId ?? node.id;
    return await loader.load(id).catch(() => null);
  }
}
