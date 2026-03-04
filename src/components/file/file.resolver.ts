import {
  Args,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { type ID, IdArg, ListArg } from '~/common';
import { Loader, type LoaderOf } from '~/core/data-loader';
import { UserLoader } from '../user';
import { User } from '../user/dto';
import {
  asFile,
  CreateFileVersion,
  File,
  FileListInput,
  FileListOutput,
  type FileNode,
  FileNodeDeleted,
  FileUploadRequested,
  IFileNode,
  MoveFile,
  RenameFile,
} from './dto';
import { FileNodeLoader } from './file-node.loader';
import * as FileUrl from './file-url.resolver-util';
import { FileService } from './file.service';

@Resolver(File)
export class FileResolver {
  constructor(protected readonly service: FileService) {}

  @Query(() => File)
  async file(
    @IdArg() id: ID,
    @Loader(FileNodeLoader) files: LoaderOf<FileNodeLoader>,
  ): Promise<File> {
    return asFile(await files.load(id));
  }

  @Query(() => IFileNode)
  async fileNode(
    @IdArg() id: ID,
    @Loader(FileNodeLoader) files: LoaderOf<FileNodeLoader>,
  ): Promise<FileNode> {
    return await files.load(id);
  }

  @ResolveField(() => User, {
    description: 'The user who uploaded the most recent version of this file',
  })
  async modifiedBy(
    @Parent() node: File,
    @Loader(UserLoader) users: LoaderOf<UserLoader>,
  ): Promise<User> {
    return await users.load(node.modifiedById);
  }

  @ResolveField(() => FileListOutput, {
    description: 'Return the versions of this file',
  })
  async children(
    @Parent() node: File,
    @ListArg(FileListInput) input: FileListInput,
  ): Promise<FileListOutput> {
    return await this.service.listChildren(node, input);
  }

  @FileUrl.Resolver()
  async url(@Parent() node: File, @FileUrl.Args() options: FileUrl.Options) {
    return await this.service.getUrl(node, options);
  }

  @Mutation(() => FileNodeDeleted, {
    description: 'Delete a file node',
  })
  async deleteFileNode(@IdArg() id: ID): Promise<FileNodeDeleted> {
    await this.service.delete(id);
    return {};
  }

  @Mutation(() => FileUploadRequested, {
    description: 'Start the file upload process by requesting an upload',
  })
  async requestFileUpload(): Promise<FileUploadRequested> {
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
  createFileVersion(@Args('input') input: CreateFileVersion): Promise<File> {
    return this.service.createFileVersion(input);
  }

  @Mutation(() => IFileNode, {
    description: 'Rename a file or directory',
  })
  async renameFileNode(@Args('input') input: RenameFile): Promise<FileNode> {
    await this.service.rename(input);
    return await this.service.getFileNode(input.id);
  }

  @Mutation(() => IFileNode, {
    description: 'Move a file or directory',
  })
  moveFileNode(@Args('input') input: MoveFile): Promise<FileNode> {
    return this.service.move(input);
  }
}
