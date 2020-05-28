import {
  Args,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { IdArg, ISession, Session } from '../../common';
import { User } from '../user';
import {
  BaseNodeConsistencyInput,
  CreateFileVersionInput,
  File,
  FileNode,
  FileNodeType,
  FileVersion,
  IFileNode,
  MoveFileInput,
  RenameFileInput,
  RequestUploadOutput,
} from './dto';
import { FileNodeResolver } from './file-node.resolver';

@Resolver(File.classType)
export class FileResolver extends FileNodeResolver(
  FileNodeType.File,
  File.classType
) {
  @Query(() => File)
  async file(@IdArg() id: string, @Session() session: ISession): Promise<File> {
    return this.service.getFile(id, session);
  }

  @Query(() => IFileNode)
  async fileNode(
    @IdArg() id: string,
    @Session() session: ISession
  ): Promise<FileNode> {
    return this.service.getFileNode(id, session);
  }

  @ResolveField(() => User, {
    description: 'The user who uploaded the most recent version of this file',
  })
  async modifiedBy(
    @Parent() node: File,
    @Session() session: ISession
  ): Promise<User> {
    return this.users.readOne(node.modifiedById, session);
  }

  @ResolveField(() => [FileVersion], {
    description: 'Return the file versions of this file',
  })
  async versions(
    @Session() session: ISession,
    @Parent() node: File
  ): Promise<FileVersion[]> {
    return this.service.getVersions(node.id, session);
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
    @IdArg() id: string,
    @Session() session: ISession
  ): Promise<boolean> {
    await this.service.delete(id, session);
    return true;
  }

  @Mutation(() => RequestUploadOutput, {
    description: 'Start the file upload process by requesting an upload',
  })
  async requestFileUpload(
    @Session() _session: ISession // require authorized
  ): Promise<RequestUploadOutput> {
    return this.service.requestUpload();
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
    @Session() session: ISession
  ): Promise<File> {
    return this.service.createFileVersion(input, session);
  }

  @Mutation(() => IFileNode, {
    description: 'Rename a file or directory',
  })
  async renameFileNode(
    @Args('input') input: RenameFileInput,
    @Session() session: ISession
  ): Promise<FileNode> {
    await this.service.rename(input, session);
    return this.service.getFileNode(input.id, session);
  }

  @Mutation(() => IFileNode, {
    description: 'Move a file or directory',
  })
  moveFileNode(
    @Args('input') input: MoveFileInput,
    @Session() session: ISession
  ): Promise<FileNode> {
    return this.service.move(input, session);
  }

  @Query(() => Boolean, {
    description: 'Check Consistency in File Nodes',
  })
  async checkFileConsistency(
    @Args('input') input: BaseNodeConsistencyInput,
    @Session() session: ISession
  ): Promise<boolean> {
    return this.service.checkFileConsistency(input.baseNode, session);
  }
}
