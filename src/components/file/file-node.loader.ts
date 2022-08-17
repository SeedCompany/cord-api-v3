import { ID } from '../../common';
import { LoaderFactory, OrderedNestDataLoader } from '../../core';
import { Directory, File, FileNode, FileVersion } from './dto';
import { FileService } from './file.service';

@LoaderFactory(() => [Directory, File, FileVersion])
export class FileNodeLoader extends OrderedNestDataLoader<FileNode> {
  constructor(private readonly files: FileService) {
    super();
  }

  async loadMany(ids: ID[]) {
    return await this.files.getFileNodes(ids, this.session);
  }
}
