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
import { stripIndent } from 'common-tags';
import { $, adapter, Client, createClient } from 'edgedb';
import { SCALAR_CODECS } from 'edgedb/dist/codecs/codecs.js';
import { KNOWN_TYPENAMES } from 'edgedb/dist/codecs/consts.js';
import { Cardinality } from 'edgedb/dist/ifaces.js';
import { $ as $$ } from 'execa';
import {
  IndentationText,
  Node,
  Project,
  QuoteKind,
  SourceFile,
  SyntaxKind,
  VariableDeclarationKind,
} from 'ts-morph';

const customScalarList: readonly CustomScalar[] = [
  { module: 'std', type: 'uuid', ts: 'ID', path: '~/common' },
  { module: 'std', type: 'datetime', ts: 'DateTime', path: 'luxon' },
  {
    module: 'cal',
    type: 'local_date',
    ts: 'CalendarDate',
    path: '~/common',
  },
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
  const schemaFile = project.addSourceFileAtPath(generatedSchemaFile);
  addCustomScalarImports(schemaFile, customScalars.values());

  // Fix the type generated from
  // Project::Resource extending default::Resource
  schemaFile.addTypeAlias({ name: 'DefaultResource', type: 'Resource' });
  schemaFile
    .getModule('Project')!
    .getInterface('Resource')!
    .removeExtends(0)
    .addExtends('DefaultResource');

  await generateQueryFiles({ client, root });
  fixCustomScalarImportsInGeneratedEdgeqlFiles(project);

  await generateInlineQueries({ client, project, root });
}

async function generateInlineQueries({
  client,
  project,
  root,
}: {
  client: Client;
  project: Project;
  root: string;
}) {
  console.log('Generating queries for edgeql() calls...');

  const grepForShortList =
    await $$`grep -lR edgeql src --exclude-dir=src/core/edgedb`;
  const shortList = project.addSourceFilesAtPaths(
    grepForShortList.stdout.split('\n'),
  );

  const queries =
    shortList.flatMap((file) =>
      file.getDescendantsOfKind(SyntaxKind.CallExpression).flatMap((call) => {
        if (call.getExpression().getText() !== 'edgeql') {
          return [];
        }
        const args = call.getArguments();

        // // 1000x slower to confirm edgeql import
        // const defs = call
        //   .getExpressionIfKindOrThrow(SyntaxKind.Identifier)
        //   .getDefinitionNodes();
        // if (
        //   !defs[0].getSourceFile().getFilePath().endsWith('edgedb/edgeql.ts')
        // ) {
        //   return [];
        // }

        if (
          args.length > 1 ||
          (!Node.isStringLiteral(args[0]) &&
            !Node.isNoSubstitutionTemplateLiteral(args[0]))
        ) {
          return [];
        }

        const query = args[0].getText().slice(1, -1);
        return { query, call };
      }),
    ) ?? [];

  const inlineQueriesFile = project.createSourceFile(
    'src/core/edgedb/generated-client/inline-queries.ts',
    `import type { TypedEdgeQL } from '../edgeql';`,
    { overwrite: true },
  );
  const queryMap = inlineQueriesFile.addInterface({
    name: 'InlineQueryMap',
    isExported: true,
  });

  const imports = new Set<string>();
  const seen = new Set<string>();
  const cardinalityMap = new Map<string, $.Cardinality>();
  for (const { query, call } of queries) {
    // Prevent duplicate keys in QueryMap in the off chance that two queries are identical
    if (seen.has(query)) {
      continue;
    }
    seen.add(query);

    const path = adapter.path.posix.relative(
      root,
      call.getSourceFile().getFilePath(),
    );
    const lineNumber = call.getStartLineNumber();
    const source = `./${path}:${lineNumber}`;

    let types;
    let error;
    try {
      types = await $.analyzeQuery(client, query);
      console.log(`   ${source}`);
    } catch (err) {
      error = err as Error;
      console.log(`Error in query '${source}': ${String(err)}`);
    }

    if (types) {
      // Save cardinality for use at runtime.
      cardinalityMap.set(
        stripIndent(query),
        cardinalityMapping[types.cardinality],
      );
      // Add imports to the used imports list
      [...types.imports].forEach((i) => imports.add(i));
    }

    queryMap.addProperty({
      name: `[\`${query}\`]`,
      type: types
        ? `TypedEdgeQL<${types.args}, ${types.result}>`
        : error
        ? `{ ${error.name}: \`${error.message.trim()}\` }`
        : 'unknown',
      leadingTrivia:
        (queryMap.getProperties().length > 0 ? '\n' : '') +
        `/** {@link import('${path}')} L${lineNumber} */\n`,
    });
  }

  addCustomScalarImports(
    inlineQueriesFile,
    [...imports].flatMap((i) => customScalars.get(i) ?? []),
    0,
  );
  const builtIn = ['$', ...[...imports].filter((i) => !customScalars.has(i))];
  inlineQueriesFile.insertImportDeclaration(0, {
    isTypeOnly: true,
    namedImports: builtIn,
    moduleSpecifier: 'edgedb',
  });

  const cardinalitiesAsStr = JSON.stringify([...cardinalityMap], null, 2);
  inlineQueriesFile.addVariableStatement({
    isExported: true,
    declarationKind: VariableDeclarationKind.Const,
    declarations: [
      {
        name: 'InlineQueryCardinalityMap',
        initializer: `new Map<string, \`\${$.Cardinality}\`>(${cardinalitiesAsStr})`,
      },
    ],
  });
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
      const prettyPath = './' + adapter.path.posix.relative(root, path);
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
  index = 2,
) {
  return file.insertImportDeclarations(
    index,
    [...scalars].map((scalar, i) => ({
      isTypeOnly: true,
      namedImports: [scalar.ts],
      moduleSpecifier: scalar.path,
      leadingTrivia: i === 0 ? '\n' : undefined,
    })),
  );
}

const cardinalityMapping = {
  [Cardinality.NO_RESULT]: $.Cardinality.Empty,
  [Cardinality.AT_MOST_ONE]: $.Cardinality.AtMostOne,
  [Cardinality.ONE]: $.Cardinality.One,
  [Cardinality.MANY]: $.Cardinality.Many,
  [Cardinality.AT_LEAST_ONE]: $.Cardinality.AtLeastOne,
};
