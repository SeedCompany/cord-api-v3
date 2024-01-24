import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { URL } from 'url';
import { FileVersion } from './dto';
import * as FileUrl from './file-url.resolver-util';
import { FileService } from './file.service';

@Resolver(FileVersion)
export class FileVersionResolver {
  constructor(protected readonly service: FileService) {}

  @FileUrl.Resolver()
  async url(@Parent() node: FileVersion) {
    return await this.service.getUrl(node);
  }

  @ResolveField(() => URL, {
    description: 'A direct url to download the file version',
    deprecationReason: stripIndent`
      Use \`url\` instead.

      Note while this url is anonymous, the new field, \`url\` is not.
    `,
  })
  downloadUrl(@Parent() node: FileVersion): Promise<string> {
    return this.service.getDownloadUrl(node);
  }
}
