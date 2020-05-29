import { FileNodeType, FileVersion } from './dto';
import { FileNodeResolver } from './file-node.resolver';

export class FileVersionResolver extends FileNodeResolver(
  FileNodeType.FileVersion,
  FileVersion.classType
) {}
