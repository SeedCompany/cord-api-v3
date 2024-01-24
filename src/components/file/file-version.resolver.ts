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
    @FileUrl.DownloadArg() download: boolean,
  ) {
    return await this.service.getUrl(node, download);
  }
}
