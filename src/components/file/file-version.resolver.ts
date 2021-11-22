import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { URL } from 'url';
import { FileVersion } from './dto';
import { FileService } from './file.service';

@Resolver(FileVersion)
export class FileVersionResolver {
  constructor(protected readonly service: FileService) {}

  @ResolveField(() => URL, {
    description: 'A direct url to download the file version',
  })
  downloadUrl(@Parent() node: FileVersion): Promise<string> {
    return this.service.getDownloadUrl(node);
  }
}
