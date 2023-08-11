import { IdOf } from '~/common';
import { LoaderFactory, SessionAwareLoaderStrategy } from '~/core';
import { Directory, File, FileNode, FileVersion, IFileNode } from './dto';
import { FileService } from './file.service';

@LoaderFactory(() => [Directory, File, FileVersion])
export class FileNodeLoader extends SessionAwareLoaderStrategy<
  FileNode,
  IdOf<IFileNode>
> {
  constructor(private readonly files: FileService) {
    super();
  }

  async loadMany(ids: Array<IdOf<IFileNode>>) {
    return await this.files.getFileNodes(ids, this.session);
  }
}
