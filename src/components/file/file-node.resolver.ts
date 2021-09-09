import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { AnonSession, Session } from '../../common';
import { DataLoader, Loader } from '../../core';
import { User } from '../user';
import { FileNode, IFileNode } from './dto';
import { FileService } from './file.service';

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
    @Loader(User) users: DataLoader<User>
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
    @AnonSession() session: Session
  ): Promise<readonly FileNode[]> {
    return await this.service.getParents(node.id, session);
  }
}
