import { generateQueryBuilder } from '@edgedb/generate/dist/edgeql-js';
import { runInterfacesGenerator as generateTsSchema } from '@edgedb/generate/dist/interfaces';

(async () => {
  const edgedbDir = 'src/core/edgedb';
  const generatedClientDir = `${edgedbDir}/generated-client`;
  const generatedSchemaFile = `${edgedbDir}/schema.ts`;

  const root = process.cwd();
  const connectionConfig = {};

  await generateQueryBuilder({
    options: {
      out: generatedClientDir,
      updateIgnoreFile: false,
      target: 'ts',
      forceOverwrite: true,
    },
    connectionConfig,
    root,
  });

  await generateTsSchema({
    options: {
      file: generatedSchemaFile,
    },
    connectionConfig,
    root,
  });
})().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
