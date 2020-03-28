import {
  Args,
  Mutation,
  Parent,
  Query,
  ResolveProperty,
  Resolver,
} from '@nestjs/graphql';
import { IdArg, ISession, Session } from '../../common';
import {
  CreateFileInput,
  File,
  FileOrDirectory,
  FileVersion,
  MoveFileInput,
  RenameFileInput,
  RequestUploadOutput,
  UpdateFileInput,
} from './dto';
import { FileService } from './file.service';

@Resolver(File.classType)
export class FileResolver {
  constructor(private readonly service: FileService) {}

  @Query(() => File)
  async file(@IdArg() id: string, @Session() session: ISession): Promise<File> {
    return this.service.getFile(id, session);
  }

  @Query(() => FileOrDirectory)
  async fileNode(
    @IdArg() id: string,
    @Session() session: ISession
  ): Promise<FileOrDirectory> {
    return this.service.getFileNode(id, session);
  }

  @ResolveProperty(() => [FileVersion], {
    description: 'Return the file versions of this file',
  })
  async versions(
    @Session() session: ISession,
    @Parent() node: File
  ): Promise<FileVersion[]> {
    return this.service.getVersions(node.id, session);
  }

  @ResolveProperty(() => String, {
    description: 'A direct url to download the file',
  })
  downloadUrl(
    @Parent() node: File,
    @Session() session: ISession
  ): Promise<string> {
    return this.service.getDownloadUrl(node.id, session);
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
  async requestUpload(
    @Session() _session: ISession // require authorized
  ): Promise<RequestUploadOutput> {
    return this.service.requestUpload();
  }

  @Mutation(() => File, {
    description: 'Create a new file in the given directory after uploading it',
  })
  createFile(
    @Args('input') input: CreateFileInput,
    @Session() session: ISession
  ): Promise<File> {
    return this.service.createFile(input, session);
  }

  @Mutation(() => File, {
    description:
      'Update an existing file (add a new version) after uploading it',
  })
  updateFile(
    @Args('input') input: UpdateFileInput,
    @Session() session: ISession
  ): Promise<File> {
    return this.service.updateFile(input, session);
  }

  @Mutation(() => FileOrDirectory, {
    description: 'Rename a file or directory',
  })
  renameFileNode(
    @Args('input') input: RenameFileInput,
    @Session() session: ISession
  ): Promise<FileOrDirectory> {
    return this.service.rename(input, session);
  }

  @Mutation(() => File, {
    description: 'Move a file or directory',
  })
  moveFileNode(
    @Args('input') input: MoveFileInput,
    @Session() session: ISession
  ): Promise<File> {
    return this.service.move(input, session);
  }
}
