import {
  mapSecuredValue,
  NotFoundException,
  ServerException,
} from '../../common';
import { DataLoader } from '../../core';
import {
  DefinedFile,
  FileNode,
  isDirectory,
  isFile,
  SecuredDirectory,
  SecuredFile,
} from './dto';

export async function resolveDefinedFile(
  loader: DataLoader<FileNode>,
  input: DefinedFile
): Promise<SecuredFile> {
  return await mapSecuredValue(input, async (fileId) => {
    try {
      const file = await loader.load(fileId);
      if (!isFile(file)) {
        throw new ServerException('Node is not a file');
      }
      return file;
    } catch (e) {
      // DefinedFiles are nullable. This works by creating the file without
      // versions which causes the direct lookup to fail.
      if (e instanceof NotFoundException) {
        return undefined;
      }
      throw e;
    }
  });
}

export async function resolveDirectory(
  loader: DataLoader<FileNode>,
  input: DefinedFile
): Promise<SecuredDirectory> {
  return await mapSecuredValue(input, async (fileId) => {
    try {
      const file = await loader.load(fileId);
      if (!isDirectory(file)) {
        throw new ServerException('Node is not a directory');
      }
      return file;
    } catch (e) {
      // DefinedFiles are nullable. This works by creating the file without
      // versions which causes the direct lookup to fail.
      if (e instanceof NotFoundException) {
        return undefined;
      }
      throw e;
    }
  });
}
