/* eslint-disable import/first,import-helpers/order-imports */
import { adapter } from 'edgedb';

const actualGenCommand = 'yarn edgedb:gen';

// Swap out references to npx for our actual yarn command before writing to disk
adapter.fs.writeFile = new Proxy(adapter.fs.writeFile, {
  apply(target: any, thisArg: any, [path, content]: any[]) {
    const patched = content.replace(
      /([`'])npx @edgedb\/generate [\w-]+[`']/,
      `$1${actualGenCommand}$1`,
    );
    return Reflect.apply(target, thisArg, [path, patched]);
  },
});
// Revert our yarn comment patch from above when reading so that the generators can
// accurately check if changed to prevent writing to disk when there are no changes.
adapter.readFileUtf8 = new Proxy(adapter.readFileUtf8, {
  apply(
    target: (...pathParts: string[]) => Promise<string>,
    thisArg: any,
    argArray: any[],
  ): any {
    return target.apply(thisArg, argArray).then((result) => {
      const upstreamGen =
        argArray.at(-1) === 'schema.ts' ? 'interfaces' : 'edgeql-js';
      const content = result.replace(
        `([\`'])${actualGenCommand}[\`']`,
        `$1npx @edgedb/generate ${upstreamGen}$1`,
      );
      return content;
    });
  },
});

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
