import {
  Args,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { AnonSession, ID, IdArg, LoggedInSession, Session } from '../../common';
import { Loader, LoaderOf } from '../../core';
import {
  asDirectory,
  CreateDirectoryInput,
  Directory,
  FileListInput,
  FileListOutput,
} from './dto';
import { FileNodeLoader } from './file-node.loader';
import { FileService } from './file.service';

@Resolver(Directory)
export class DirectoryResolver {
  constructor(protected readonly service: FileService) {}

  @Query(() => Directory)
  async directory(
    @IdArg() id: ID,
    @Loader(FileNodeLoader) files: LoaderOf<FileNodeLoader>
  ): Promise<Directory> {
    return asDirectory(await files.load(id));
  }

  @ResolveField(() => FileListOutput, {
    description: 'Return the file nodes of this directory',
  })
  async children(
    @AnonSession() session: Session,
    @Parent() node: Directory,
    @Args({
      name: 'input',
      type: () => FileListInput,
      defaultValue: FileListInput.defaultVal,
    })
    input: FileListInput
  ): Promise<FileListOutput> {
    return await this.service.listChildren(node, input, session);
  }

  @Mutation(() => Directory)
  async createDirectory(
    @LoggedInSession() session: Session,
    @Args('input') { parentId, name }: CreateDirectoryInput
  ): Promise<Directory> {
    return await this.service.createDirectory(parentId, name, session);
  }
}
