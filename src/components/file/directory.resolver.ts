import { Args, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { type ID, IdArg, ListArg } from '~/common';
import { Loader, type LoaderOf } from '~/core';
import { UserLoader } from '../user';
import { User } from '../user/dto';
import {
  asDirectory,
  CreateDirectoryInput,
  Directory,
  File,
  FileListInput,
  FileListOutput,
  type FileNode,
} from './dto';
import { FileNodeLoader } from './file-node.loader';
import { FileService } from './file.service';

@Resolver(Directory)
export class DirectoryResolver {
  constructor(protected readonly service: FileService) {}

  @Query(() => Directory)
  async directory(
    @IdArg() id: ID,
    @Loader(FileNodeLoader) files: LoaderOf<FileNodeLoader>,
  ): Promise<Directory> {
    return asDirectory(await files.load(id));
  }

  @ResolveField(() => FileListOutput, {
    description: 'Return the file nodes of this directory',
  })
  async children(
    @Parent() node: Directory,
    @ListArg(FileListInput) input: FileListInput,
  ): Promise<FileListOutput> {
    return await this.service.listChildren(node, input);
  }

  @ResolveField(() => User, {
    description:
      'The user who uploaded the most recent file in this directory or any subdirectories',
  })
  async modifiedBy(
    @Parent() node: Directory,
    @Loader(UserLoader) users: LoaderOf<UserLoader>,
  ): Promise<User> {
    return await users.load(node.modifiedBy);
  }

  @ResolveField(() => File, {
    nullable: true,
    description: stripIndent`
      The first file created in this directory or any subdirectories.

      This can be useful to determine the time the directory was "first used".
    `,
  })
  async firstFileCreated(
    @Parent() node: Directory,
    @Loader(FileNodeLoader) files: LoaderOf<FileNodeLoader>,
  ): Promise<FileNode | null> {
    return node.firstFileCreated ? await files.load(node.firstFileCreated) : null;
  }

  @Mutation(() => Directory)
  async createDirectory(
    @Args('input') { parentId, name }: CreateDirectoryInput,
  ): Promise<Directory> {
    return await this.service.createDirectory(parentId, name);
  }
}
