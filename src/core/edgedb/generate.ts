/* eslint-disable no-console */
import { generateQueryBuilder } from '@edgedb/generate/dist/edgeql-js.js';
import {
  headerComment,
  scalarToLiteralMapping,
} from '@edgedb/generate/dist/genutil.js';
import { runInterfacesGenerator as generateTsSchema } from '@edgedb/generate/dist/interfaces.js';
import {
  generateFiles,
  stringifyImports,
} from '@edgedb/generate/dist/queries.js';
import { groupBy, mapKeys } from '@seedcompany/common';
import { $, adapter, Client, createClient } from 'edgedb';
import { SCALAR_CODECS } from 'edgedb/dist/codecs/codecs.js';
import { KNOWN_TYPENAMES } from 'edgedb/dist/codecs/consts.js';
import {
  IndentationText,
  Project,
  QuoteKind,
  SourceFile,
  SyntaxKind,
} from 'ts-morph';

const customScalarList: readonly CustomScalar[] = [
  { module: 'std', type: 'uuid', ts: 'ID', path: '~/common' },
];
const customScalars = mapKeys.fromList(customScalarList, (s) => s.ts).asMap;
interface CustomScalar {
  module: string;
  type: string;
  ts: string;
  path: string;
}

const customScalarImportCheck = RegExp(
  `import type {.*(${[...customScalars.keys()].join('|')}).*} from "edgedb";`,
);
const pathsNeedingScalarImportFix = new Set<string>();

// Patch into writeFile to check for custom scalar imports, that will need to be fixed.
adapter.fs.writeFile = new Proxy(adapter.fs.writeFile, {
  apply(target: any, thisArg: any, [path, content]: any[]) {
    if (
      !path.includes('generated-client') &&
      content.match(customScalarImportCheck)
    ) {
      pathsNeedingScalarImportFix.add(path);
    }
    return Reflect.apply(target, thisArg, [path, content]);
  },
});

(async () => {
  const project = createTsMorphProject();
  const client = createClient({
    concurrency: 5,
  });
  await client.ensureConnected();

  try {
    await generateAll({ client, project });
  } finally {
    await client.close();
  }

  await project.save();

  console.log('Done!');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

async function generateAll({
  client,
  project,
}: {
  client: Client;
  project: Project;
}) {
  const root = process.cwd();
  const edgedbDir = 'src/core/edgedb';
  const generatedClientDir = `${edgedbDir}/generated-client`;
  const generatedSchemaFile = `${edgedbDir}/schema.ts`;

  changeScalarCodecsToOurCustomTypes();

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
  changeCustomScalarsInQueryBuilder(project, generatedClientDir);
  changeImplicitIDTypeToOurCustomScalar(project, generatedClientDir);

  await generateTsSchema({
    options: {
      file: generatedSchemaFile,
    },
    client,
    root,
  });
  addCustomScalarImports(
    project.addSourceFileAtPath(generatedSchemaFile),
    customScalars.values(),
  );

  await generateQueryFiles({ client, root });
  fixCustomScalarImportsInGeneratedEdgeqlFiles(project);
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

function changeScalarCodecsToOurCustomTypes() {
  for (const scalar of customScalars.values()) {
    const fqName = `${scalar.module}::${scalar.type}`;

    // codes are used for edgeql files
    const id = KNOWN_TYPENAMES.get(fqName)!;
    const codec = SCALAR_CODECS.get(id)!;
    Object.assign(codec, { tsType: scalar.ts, importedType: true });

    // this is used for schema interfaces
    scalarToLiteralMapping[fqName].type = scalar.ts;
  }
}

function changeCustomScalarsInQueryBuilder(
  project: Project,
  generatedClientDir: string,
) {
  // Change $uuid scalar type alias to use ID type instead of string
  for (const scalars of groupBy(customScalars.values(), (s) => s.module)) {
    const moduleFile = project.addSourceFileAtPath(
      `${generatedClientDir}/modules/${scalars[0]!.module}.mts`,
    );
    for (const scalar of scalars) {
      const typeAlias = moduleFile.getTypeAliasOrThrow(`$${scalar.type}`);
      typeAlias
        .getFirstChildByKindOrThrow(SyntaxKind.TypeReference)
        .getFirstChildByKindOrThrow(SyntaxKind.SyntaxList)
        .getLastChildOrThrow()
        .replaceWithText(scalar.ts);
    }
    addCustomScalarImports(moduleFile, scalars);
  }
}

function changeImplicitIDTypeToOurCustomScalar(
  project: Project,
  generatedClientDir: string,
) {
  // Change implicit return shapes that are just the id to be ID type.
  const typesystem = project.addSourceFileAtPath(
    `${generatedClientDir}/typesystem.mts`,
  );
  addCustomScalarImports(typesystem, [customScalars.get('ID')!]);
  typesystem.replaceWithText(
    typesystem.getFullText().replaceAll('{ id: string }', '{ id: ID }'),
  );
}

function fixCustomScalarImportsInGeneratedEdgeqlFiles(project: Project) {
  const toRemove = new Set(customScalars.keys());
  for (const path of pathsNeedingScalarImportFix) {
    const toAdd = new Set<CustomScalar>();
    const file = project.addSourceFileAtPath(path);
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

function createTsMorphProject() {
  return new Project({
    tsConfigFilePath: 'tsconfig.json',
    skipAddingFilesFromTsConfig: true,
    manipulationSettings: {
      indentationText: IndentationText.TwoSpaces,
      quoteKind: QuoteKind.Single,
      useTrailingCommas: true,
    },
  });
}

function addCustomScalarImports(
  file: SourceFile,
  scalars: Iterable<CustomScalar>,
) {
  file.insertImportDeclarations(
    2,
    [...scalars].map((scalar, i) => ({
      isTypeOnly: true,
      namedImports: [scalar.ts],
      moduleSpecifier: scalar.path,
      leadingTrivia: i === 0 ? '\n' : undefined,
    })),
  );
}
