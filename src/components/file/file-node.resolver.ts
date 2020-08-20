import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { ISession, Session } from '../../common';
import { User, UserService } from '../user';
import { FileNode, IFileNode } from './dto';
import { FileService } from './file.service';

@Resolver(IFileNode)
export class FileNodeResolver {
  constructor(
    protected readonly service: FileService,
    protected readonly users: UserService
  ) {}

  @ResolveField(() => User, {
    description: stripIndent`
      The user who created this node.
      For files, this is the user who uploaded the first version of the file.
    `,
  })
  async createdBy(
    @Parent() node: FileNode,
    @Session() session: ISession
  ): Promise<User> {
    return await this.users.readOne(node.createdById, session);
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
    @Session() session: ISession
  ): Promise<readonly FileNode[]> {
    return await this.service.getParents(node.id, session);
  }
}
