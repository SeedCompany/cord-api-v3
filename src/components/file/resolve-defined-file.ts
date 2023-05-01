import { LoaderOf } from '@seedcompany/data-loader';
import { mapSecuredValue, NotFoundException, ServerException } from '~/common';
import { DefinedFile, isFile, SecuredFile } from './dto';
import { FileNodeLoader } from './file-node.loader';

export async function resolveDefinedFile(
  loader: LoaderOf<FileNodeLoader>,
  input: DefinedFile,
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
