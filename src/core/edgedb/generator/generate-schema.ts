import { runInterfacesGenerator } from '@edgedb/generate/dist/interfaces.js';
import { customScalars } from './scalars';
import { addCustomScalarImports, GeneratorParams } from './util';

export async function generateSchema({
  client,
  root,
  edgedbDir,
}: GeneratorParams) {
  const schemaFile = edgedbDir.createSourceFile('schema.ts', undefined, {
    overwrite: true,
  });
  await runInterfacesGenerator({
    options: {
      file: schemaFile.getFilePath(),
    },
    client,
    root: root.getPath(),
  });
  await schemaFile.refreshFromFileSystem();
  addCustomScalarImports(schemaFile, customScalars.values());
}
