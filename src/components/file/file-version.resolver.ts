import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { FileNodeType, FileVersion } from './dto';
import { FileNodeResolver } from './file-node.resolver';

@Resolver(FileVersion.classType)
export class FileVersionResolver extends FileNodeResolver(
  FileNodeType.FileVersion,
  FileVersion.classType
) {
  @ResolveField(() => String, {
    description: 'A direct url to download the file version',
  })
  downloadUrl(@Parent() node: FileVersion): Promise<string> {
    return this.service.getDownloadUrl(node);
  }
}
