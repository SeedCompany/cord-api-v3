import { runInterfacesGenerator } from '@gel/generate/dist/interfaces.js';
import { customScalars } from './scalars';
import { addCustomScalarImports, GeneratorParams } from './util';

export async function generateSchema({
  client,
  root,
  gelDir,
}: GeneratorParams) {
  const schemaFile = gelDir.createSourceFile('schema.ts', undefined, {
    overwrite: true,
  });
  await runInterfacesGenerator({
    options: {
      file: schemaFile.getFilePath(),
    },
    client,
    root: root.getPath(),
    schemaDir: 'unused',
  });
  await schemaFile.refreshFromFileSystem();
  addCustomScalarImports(schemaFile, customScalars.values());
}
