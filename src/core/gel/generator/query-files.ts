import { headerComment } from '@gel/generate/dist/genutil.js';
import { generateFiles, stringifyImports } from '@gel/generate/dist/queries.js';
import { readFile, writeFile } from 'fs/promises';
import { $, Client, systemUtils } from 'gel';
import { join, relative } from 'node:path/posix';
import { injectHydrators } from './inject-hydrators';
import { GeneratorParams } from './util';

export async function generateQueryFiles(params: GeneratorParams) {
  const srcDir = join(params.root.getPath(), 'src');
  const files = await systemUtils.walk(srcDir, {
    match: [/[^/]\.edgeql$/],
  });
  console.log(`Generating files for following queries:`);
  await Promise.all(files.map(generateFilesForQuery(params)));
}

const generateFilesForQuery =
  ({ client, root, hydrators }: GeneratorParams) =>
  async (path: string) => {
    const prettyPath = './' + relative(root.getPath(), path);
    try {
      const query = await readFile(path, 'utf8');
      if (!query) return;

      const injectedQuery = injectHydrators(query, hydrators);

      const types = await analyzeQuery(client, injectedQuery);
      const [{ imports, contents }] = generateFiles({
        target: 'ts',
        path,
        types,
      });
      console.log(`   ${prettyPath}`);
      await writeFile(
        path + '.ts',
        headerComment + `${stringifyImports(imports)}\n\n${contents}`,
        'utf8',
      );
    } catch (err) {
      console.log(`Error in file '${prettyPath}': ${String(err)}`);
    }
  };

/**
 * Same thing as what upstream function does, just with readonly on the output type.
 */
export async function analyzeQuery(client: Client, query: string) {
  const { cardinality, in: inCodec, out: outCodec } = await client.parse(query);
  const args = $.generateTSTypeFromCodec(inCodec, $.Cardinality.One, {
    readonly: true,
    optionalNulls: true,
  });
  const result = $.generateTSTypeFromCodec(outCodec, cardinality, {
    readonly: true,
    optionalNulls: false,
  });
  return {
    result: result.type,
    args: args.type,
    cardinality,
    query,
    importMap: args.imports.merge(result.imports),
  };
}
