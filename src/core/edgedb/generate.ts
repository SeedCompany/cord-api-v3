/* eslint-disable no-console */
import { generateQueryBuilder } from '@edgedb/generate/dist/edgeql-js.js';
import { headerComment } from '@edgedb/generate/dist/genutil.js';
import { runInterfacesGenerator as generateTsSchema } from '@edgedb/generate/dist/interfaces.js';
import {
  generateFiles,
  stringifyImports,
} from '@edgedb/generate/dist/queries.js';
import { $, adapter, Client, createClient } from 'edgedb';

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

  await generateQueryFiles({ client, root });
}

async function generateQueryFiles({
  client,
  root,
}: {
  client: Client;
  root: string;
}) {
  const srcDir = adapter.path.join(root, 'src');
  const files = await adapter.walk(srcDir, {
    match: [/[^/]\.edgeql$/],
  });
  async function generateFilesForQuery(path: string) {
    try {
      const query = await adapter.readFileUtf8(path);
      if (!query) return;
      const types = await $.analyzeQuery(client, query);
      const [{ imports, contents }] = generateFiles({
        target: 'ts',
        path,
        types,
      });
      const prettyPath = './' + adapter.path.posix.relative(srcDir, path);
      console.log(`   ${prettyPath}`);
      await adapter.fs.writeFile(
        path + '.ts',
        headerComment + `${stringifyImports(imports)}\n\n${contents}`,
      );
    } catch (err) {
      console.log(
        `Error in file './${adapter.path.posix.relative(root, path)}': ${String(
          err,
        )}`,
      );
    }
  }
  console.log(`Generating files for following queries:`);
  await Promise.all(files.map(generateFilesForQuery));
}
