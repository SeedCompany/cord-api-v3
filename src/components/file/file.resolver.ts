import {
  Args,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { AnonSession, ID, IdArg, LoggedInSession, Session } from '../../common';
import { DataLoader, Loader } from '../../core';
import { User } from '../user';
import {
  CreateFileVersionInput,
  File,
  FileListInput,
  FileListOutput,
  FileNode,
  IFileNode,
  MoveFileInput,
  RenameFileInput,
  RequestUploadOutput,
} from './dto';
import { FileService } from './file.service';

@Resolver(File)
export class FileResolver {
  constructor(protected readonly service: FileService) {}

  @Query(() => File)
  async file(
    @IdArg() id: ID,
    @LoggedInSession() session: Session
  ): Promise<File> {
    return await this.service.getFile(id, session);
  }

  @Query(() => IFileNode)
  async fileNode(
    @IdArg() id: ID,
    @LoggedInSession() session: Session
  ): Promise<FileNode> {
    return await this.service.getFileNode(id, session);
  }

  @ResolveField(() => User, {
    description: 'The user who uploaded the most recent version of this file',
  })
  async modifiedBy(
    @Parent() node: File,
    @Loader(User) users: DataLoader<User>
  ): Promise<User> {
    return await users.load(node.modifiedById);
  }

  @ResolveField(() => FileListOutput, {
    description: 'Return the versions of this file',
  })
  async children(
    @AnonSession() session: Session,
    @Parent() node: File,
    @Args({
      name: 'input',
      type: () => FileListInput,
      defaultValue: FileListInput.defaultVal,
    })
    input: FileListInput
  ): Promise<FileListOutput> {
    return await this.service.listChildren(node, input, session);
  }

  @ResolveField(() => String, {
    description: 'A direct url to download the file',
  })
  downloadUrl(@Parent() node: File): Promise<string> {
    return this.service.getDownloadUrl(node);
  }

  @Mutation(() => Boolean, {
    description: 'Delete a file or directory',
  })
  async deleteFileNode(
    @IdArg() id: ID,
    @LoggedInSession() session: Session
  ): Promise<boolean> {
    await this.service.delete(id, session);
    return true;
  }

  @Mutation(() => RequestUploadOutput, {
    description: 'Start the file upload process by requesting an upload',
  })
  async requestFileUpload(
    @LoggedInSession() _session: Session // require authorized
  ): Promise<RequestUploadOutput> {
    return await this.service.requestUpload();
  }

  @Mutation(() => File, {
    description: stripIndent`
      Create a new file version.
      This is always the second step after \`requestFileUpload\` mutation.
      If the given parent is a file, this will attach the new version to it.
      If the given parent is a directory, this will attach the new version to
      the existing file with the same name or create a new file if not found.
    `,
  })
  createFileVersion(
    @Args('input') input: CreateFileVersionInput,
    @LoggedInSession() session: Session
  ): Promise<File> {
    return this.service.createFileVersion(input, session);
  }

  @Mutation(() => IFileNode, {
    description: 'Rename a file or directory',
  })
  async renameFileNode(
    @Args('input') input: RenameFileInput,
    @LoggedInSession() session: Session
  ): Promise<FileNode> {
    await this.service.rename(input, session);
    return await this.service.getFileNode(input.id, session);
  }

  @Mutation(() => IFileNode, {
    description: 'Move a file or directory',
  })
  moveFileNode(
    @Args('input') input: MoveFileInput,
    @LoggedInSession() session: Session
  ): Promise<FileNode> {
    return this.service.move(input, session);
  }
}
