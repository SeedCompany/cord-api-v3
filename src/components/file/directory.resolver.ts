import {
  Parent,
  Query,
  ResolveProperty,
  Resolver,
  Args,
  Mutation,
} from '@nestjs/graphql';
import { IdArg } from '../../common';
import { ISession, Session } from '../auth';
import { Directory, FileListInput, FileListOutput } from './dto';
import { FileService } from './file.service';

@Resolver(Directory.classType)
export class DirectoryResolver {
  constructor(private readonly service: FileService) {}

  @Query(() => Directory)
  async directory(@IdArg() id: string, session: ISession): Promise<Directory> {
    return this.service.getDirectory(id, session);
  }

  @ResolveProperty(() => FileListOutput, {
    description: 'Return the file nodes of this directory',
  })
  async children(
    @Session() session: ISession,
    @Parent() node: Directory,
    @Args({
      name: 'input',
      type: () => FileListInput,
      defaultValue: FileListInput.defaultVal,
    })
    input: FileListInput,
  ): Promise<FileListOutput> {
    return this.service.listChildren(input, session);
  }

  @Mutation(() => Directory)
  async createDirectory(
    @Session() session: ISession,
    @Args('name') name: string,
  ): Promise<Directory> {
    return this.service.createDirectory(name, session);
  }
}
