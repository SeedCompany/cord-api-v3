import { type ID } from '~/common';
import { type DataLoaderStrategy, LoaderFactory } from '~/core/data-loader';
import { Directory, File, type FileNode, FileVersion } from './dto';
import { FileService } from './file.service';

@LoaderFactory(() => [Directory, File, FileVersion])
export class FileNodeLoader
  implements DataLoaderStrategy<FileNode, ID<'FileNode'>>
{
  constructor(private readonly files: FileService) {}

  async loadMany(ids: ReadonlyArray<ID<'FileNode'>>) {
    return await this.files.getFileNodes(ids);
  }
}
