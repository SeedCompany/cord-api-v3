import { Parent, Resolver } from '@nestjs/graphql';
import { FileVersion } from './dto';
import * as FileUrl from './file-url.resolver-util';
import { FileService } from './file.service';

@Resolver(FileVersion)
export class FileVersionResolver {
  constructor(protected readonly service: FileService) {}

  @FileUrl.Resolver()
  async url(
    @Parent() node: FileVersion,
    @FileUrl.Args() options: FileUrl.Options,
  ) {
    return await this.service.getUrl(node, options);
  }
}
