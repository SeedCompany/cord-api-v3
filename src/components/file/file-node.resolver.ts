import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { Class } from 'type-fest';
import { ISession, Session, simpleSwitch } from '../../common';
import { User, UserService } from '../user';
import { Directory, FileNode, FileNodeType } from './dto';
import { FileService } from './file.service';

export function FileNodeResolver<T>(
  type: FileNodeType,
  concreteClass: Class<T>
) {
  @Resolver(concreteClass)
  class FileNodeResolver {
    constructor(
      protected readonly service: FileService,
      protected readonly users: UserService
    ) {}

    @ResolveField(() => User, {
      description: simpleSwitch(type, {
        [FileNodeType.Directory]: 'The user who created this directory',
        [FileNodeType.File]:
          'The user who uploaded the first version of this file',
        [FileNodeType.FileVersion]: 'The user who created this file version',
      }),
    })
    async createdBy(
      @Parent() node: FileNode,
      @Session() session: ISession
    ): Promise<User> {
      return this.users.readOne(node.createdById, session);
    }

    @ResolveField(() => [Directory], {
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
      return this.service.getParents(node.id, session);
    }
  }
  return FileNodeResolver;
}
