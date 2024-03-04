import { headerComment } from '@edgedb/generate/dist/genutil.js';
import {
  generateFiles,
  stringifyImports,
} from '@edgedb/generate/dist/queries.js';
import { $, adapter, Client } from 'edgedb';
import { Directory } from 'ts-morph';
import { ScalarInfo } from '../codecs';
import { injectHydrators } from './inject-hydrators';
import { customScalars } from './scalars';
import { addCustomScalarImports, GeneratorParams } from './util';

export async function generateQueryFiles(params: GeneratorParams) {
  const srcDir = adapter.path.join(params.root.getPath(), 'src');
  const files = await adapter.walk(srcDir, {
    match: [/[^/]\.edgeql$/],
  });
  console.log(`Generating files for following queries:`);
  await Promise.all(files.map(generateFilesForQuery(params)));

  fixCustomScalarImports(params.root);
}

const generateFilesForQuery =
  ({ client, root, hydrators }: GeneratorParams) =>
  async (path: string) => {
    const prettyPath = './' + adapter.path.posix.relative(root.getPath(), path);
    try {
      const query = await adapter.readFileUtf8(path);
      if (!query) return;

      const injectedQuery = injectHydrators(query, hydrators);

      const types = await analyzeQuery(client, injectedQuery);
      const [{ imports, contents }] = generateFiles({
        target: 'ts',
        path,
        types,
      });
      console.log(`   ${prettyPath}`);
      await adapter.fs.writeFile(
        path + '.ts',
        headerComment + `${stringifyImports(imports)}\n\n${contents}`,
      );
    } catch (err) {
      console.log(`Error in file '${prettyPath}': ${String(err)}`);
    }
  };

function fixCustomScalarImports(root: Directory) {
  const toRemove = new Set(customScalars.keys());
  for (const path of pathsNeedingScalarImportFix) {
    const toAdd = new Set<ScalarInfo>();
    const file = root.addSourceFileAtPath(path);
    file
      .getImportDeclarationOrThrow('edgedb')
      .getNamedImports()
      .filter((i) => toRemove.has(i.getName()))
      .forEach((i) => {
        toAdd.add(customScalars.get(i.getName())!);
        i.remove();
      });
    addCustomScalarImports(file, toAdd);
  }
}

const customScalarImportCheck = RegExp(
  `import type {.*(${[...customScalars.keys()].join('|')}).*} from "edgedb";`,
);
const pathsNeedingScalarImportFix = new Set<string>();

// Patch into writeFile to check for custom scalar imports that will need to be fixed.
adapter.fs.writeFile = new Proxy(adapter.fs.writeFile, {
  apply(target: any, thisArg: any, [path, content]: any[]) {
    if (path.endsWith('.edgeql.ts') && content.match(customScalarImportCheck)) {
      pathsNeedingScalarImportFix.add(path);
    }
    return Reflect.apply(target, thisArg, [path, content]);
  },
});

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
    imports: new Set([...args.imports, ...result.imports]),
  };
}
