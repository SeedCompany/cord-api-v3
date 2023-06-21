/* eslint-disable no-console */
import { generateQueryBuilder } from '@edgedb/generate/dist/edgeql-js.js';
import { runInterfacesGenerator as generateTsSchema } from '@edgedb/generate/dist/interfaces.js';
import { Client, createClient } from 'edgedb';

(async () => {
  const client = createClient({
    concurrency: 5,
  });
  await client.ensureConnected();

  try {
    await generateAll({ client });
  } finally {
    await client.close();
  }

  console.log('Done!');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

async function generateAll({ client }: { client: Client }) {
  const root = process.cwd();
  const edgedbDir = 'src/core/edgedb';
  const generatedClientDir = `${edgedbDir}/generated-client`;
  const generatedSchemaFile = `${edgedbDir}/schema.ts`;

  await generateQueryBuilder({
    options: {
      out: generatedClientDir,
      updateIgnoreFile: false,
      target: 'mts',
      forceOverwrite: true,
    },
    client,
    root,
  });

  await generateTsSchema({
    options: {
      file: generatedSchemaFile,
    },
    client,
    root,
  });
}
