import { LoaderOf } from '@seedcompany/data-loader';
import {
  isIdLike,
  mapSecuredValue,
  NotFoundException,
  Secured,
  ServerException,
} from '~/common';
import { LinkTo } from '~/core';
import { FileId, isFile, SecuredFile } from './dto';
import { FileNodeLoader } from './file-node.loader';

export async function resolveDefinedFile(
  loader: LoaderOf<FileNodeLoader>,
  input: Secured<FileId | LinkTo<'File'>>,
): Promise<SecuredFile> {
  return await mapSecuredValue(input, async (file) => {
    const fileId = isIdLike(file) ? file : file.id;
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
