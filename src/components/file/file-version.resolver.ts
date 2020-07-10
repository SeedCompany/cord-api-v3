import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { FileVersion } from './dto';
import { FileService } from './file.service';

@Resolver(FileVersion)
export class FileVersionResolver {
  constructor(protected readonly service: FileService) {}

  @ResolveField(() => String, {
    description: 'A direct url to download the file version',
  })
  downloadUrl(@Parent() node: FileVersion): Promise<string> {
    return this.service.getDownloadUrl(node);
  }
}
