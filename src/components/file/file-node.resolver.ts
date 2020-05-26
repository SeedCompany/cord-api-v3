import { Field, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { Class } from 'type-fest';
import { ISession, Session } from '../../common';
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
      description:
        type === FileNodeType.Directory
          ? 'The user who created this directory'
          : 'The user who uploaded the first version of this file',
    })
    async createdBy(
      @Parent() node: FileNode,
      @Session() session: ISession
    ): Promise<User> {
      return this.users.readOne(node.createdById, session);
    }

    @Field(() => [Directory], {
      description: stripIndent`
        A list of the parents all the way up the tree.
        This can be used to populate a path-like UI,
        without having to fetch each parent serially.
      `,
    })
    async parents(
      @Parent() node: FileNode,
      @Session() session: ISession
    ): Promise<readonly Directory[]> {
      return this.service.getParents(node.id, session);
    }
  }
  return FileNodeResolver;
}
