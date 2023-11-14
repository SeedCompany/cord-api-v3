import { headerComment } from '@edgedb/generate/dist/genutil.js';
import {
  generateFiles,
  stringifyImports,
} from '@edgedb/generate/dist/queries.js';
import { $, adapter } from 'edgedb';
import { Directory } from 'ts-morph';
import { CustomScalar, customScalars } from './scalars';
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
  ({ client, root }: GeneratorParams) =>
  async (path: string) => {
    const prettyPath = './' + adapter.path.posix.relative(root.getPath(), path);
    try {
      const query = await adapter.readFileUtf8(path);
      if (!query) return;
      const types = await $.analyzeQuery(client, query);
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
    const toAdd = new Set<CustomScalar>();
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
