import { stripIndent } from 'common-tags';
import { $, adapter } from 'edgedb';
import { Cardinality } from 'edgedb/dist/ifaces.js';
import { $ as $$ } from 'execa';
import { Node, SyntaxKind, VariableDeclarationKind } from 'ts-morph';
import { injectHydrators } from './inject-hydrators';
import { analyzeQuery } from './query-files';
import { customScalars } from './scalars';
import { addCustomScalarImports, GeneratorParams } from './util';

export async function generateInlineQueries({
  client,
  root,
  hydrators,
}: GeneratorParams) {
  console.log('Generating queries for edgeql() calls...');

  const grepForShortList = await $$({
    reject: false,
    cwd: root.getPath(),
  })`grep -lR edgeql src --exclude-dir=src/core/edgedb`;
  const shortList = grepForShortList.stdout
    ? root.addSourceFilesAtPaths(grepForShortList.stdout.split('\n'))
    : [];

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

  const inlineQueriesFile = root.createSourceFile(
    'src/core/edgedb/generated-client/inline-queries.ts',
    `import type { TypedEdgeQL } from '../edgeql';`,
    { overwrite: true },
  );
  const queryMapType = inlineQueriesFile.addInterface({
    name: 'InlineQueryMap',
    isExported: true,
  });

  const imports = new Set<string>();
  const seen = new Set<string>();
  const queryMap = new Map<
    string,
    { query: string; cardinality: $.Cardinality }
  >();
  for (const { query, call } of queries) {
    // Prevent duplicate keys in QueryMap in the off chance that two queries are identical
    if (seen.has(query)) {
      continue;
    }
    seen.add(query);

    const path = adapter.path.posix.relative(
      root.getPath(),
      call.getSourceFile().getFilePath(),
    );
    const lineNumber = call.getStartLineNumber();
    const source = `./${path}:${lineNumber}`;

    let types;
    let error;
    try {
      const injectedQuery = injectHydrators(query, hydrators);

      types = await analyzeQuery(client, injectedQuery);
      console.log(`   ${source}`);
    } catch (err) {
      error = err as Error;
      console.log(`Error in query '${source}': ${String(err)}`);
    }

    if (types) {
      // Save cardinality & hydrated query for use at runtime.
      queryMap.set(stripIndent(query), {
        query: injectHydrators(query, hydrators),
        cardinality: cardinalityMapping[types.cardinality],
      });
      // Add imports to the used imports list
      [...types.imports].forEach((i) => imports.add(i));
    }

    queryMapType.addProperty({
      name: `[\`${query}\`]`,
      type: types
        ? `TypedEdgeQL<${types.args}, ${types.result}>`
        : error
        ? `{ ${error.name}: \`${error.message.trim()}\` }`
        : 'unknown',
      leadingTrivia:
        (queryMapType.getProperties().length > 0 ? '\n' : '') +
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

  const queryMapAsStr = JSON.stringify([...queryMap], null, 2);
  inlineQueriesFile.addVariableStatement({
    isExported: true,
    declarationKind: VariableDeclarationKind.Const,
    declarations: [
      {
        name: 'InlineQueryRuntimeMap',
        initializer: `new Map<string, { query: string, cardinality: \`\${$.Cardinality}\` }>(${queryMapAsStr})`,
      },
    ],
  });
}

const cardinalityMapping = {
  [Cardinality.NO_RESULT]: $.Cardinality.Empty,
  [Cardinality.AT_MOST_ONE]: $.Cardinality.AtMostOne,
  [Cardinality.ONE]: $.Cardinality.One,
  [Cardinality.MANY]: $.Cardinality.Many,
  [Cardinality.AT_LEAST_ONE]: $.Cardinality.AtLeastOne,
};
