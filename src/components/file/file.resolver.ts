import {
  Args,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { URL } from 'url';
import {
  AnonSession,
  ID,
  IdArg,
  ListArg,
  LoggedInSession,
  Session,
} from '../../common';
import { Loader, LoaderOf } from '../../core';
import { User, UserLoader } from '../user';
import {
  asFile,
  CreateFileVersionInput,
  DeleteFileNodeOutput,
  File,
  FileListInput,
  FileListOutput,
  FileNode,
  IFileNode,
  MoveFileInput,
  RenameFileInput,
  RequestUploadOutput,
} from './dto';
import { FileNodeLoader } from './file-node.loader';
import { FileService } from './file.service';

@Resolver(File)
export class FileResolver {
  constructor(protected readonly service: FileService) {}

  @Query(() => File)
  async file(
    @IdArg() id: ID,
    @Loader(FileNodeLoader) files: LoaderOf<FileNodeLoader>
  ): Promise<File> {
    return asFile(await files.load(id));
  }

  @Query(() => IFileNode)
  async fileNode(
    @IdArg() id: ID,
    @Loader(FileNodeLoader) files: LoaderOf<FileNodeLoader>
  ): Promise<FileNode> {
    return await files.load(id);
  }

  @ResolveField(() => User, {
    description: 'The user who uploaded the most recent version of this file',
  })
  async modifiedBy(
    @Parent() node: File,
    @Loader(UserLoader) users: LoaderOf<UserLoader>
  ): Promise<User> {
    return await users.load(node.modifiedById);
  }

  @ResolveField(() => FileListOutput, {
    description: 'Return the versions of this file',
  })
  async children(
    @AnonSession() session: Session,
    @Parent() node: File,
    @ListArg(FileListInput) input: FileListInput
  ): Promise<FileListOutput> {
    return await this.service.listChildren(node, input, session);
  }

  @ResolveField(() => URL, {
    description: stripIndent`
      A url to the file.

      This url could require authentication.
    `,
  })
  async url(@Parent() node: File) {
    return await this.service.getUrl(node);
  }

  @ResolveField(() => URL, {
    description: 'A direct url to download the file',
  })
  downloadUrl(@Parent() node: File): Promise<string> {
    return this.service.getDownloadUrl(node);
  }

  @Mutation(() => DeleteFileNodeOutput, {
    description: 'Delete a file node',
  })
  async deleteFileNode(
    @IdArg() id: ID,
    @LoggedInSession() session: Session
  ): Promise<DeleteFileNodeOutput> {
    await this.service.delete(id, session);
    return { success: true };
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
