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
// Change .edgeql files to generate at a .edgeql suffix instead of .query.
// This better represents the connection between the two files and looks nice in
// TS import statements.
// It is also consistent with how we generate ts files from .graphql files in other places.
// This also allows us to safely ignore those generated files while keeping our
// other versioned files that include .query.ts.
// Unfortunately, the only way to do this is to monkey patch the path.join method.
adapter.path = new Proxy(adapter.path, {
  get(target: any, p: string | symbol, receiver: any): any {
    if (p !== 'join') {
      return Reflect.get(target, p, receiver);
    }
    return (...segments: string[]) => {
      if (segments.at(-1)!.endsWith('.query')) {
        segments.push(segments.pop()!.replace('.query', '.edgeql'));
      }
      return Reflect.apply(
        Reflect.get(target, p, receiver),
        undefined,
        segments,
      );
    };
  },
});

import { generateQueryBuilder } from '@edgedb/generate/dist/edgeql-js';
import { runInterfacesGenerator as generateTsSchema } from '@edgedb/generate/dist/interfaces';
import { generateQueryFiles } from '@edgedb/generate/dist/queries';
import {
  IndentationText,
  Project,
  QuoteKind,
  SourceFile,
  SyntaxKind,
} from 'ts-morph';

(async () => {
  const edgedbDir = 'src/core/edgedb';
  const generatedClientDir = `${edgedbDir}/generated-client`;
  const generatedSchemaFile = `${edgedbDir}/schema.ts`;

  const project = createTsMorphProject();
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
  changeQueryBuilderToUseIdTypeForUuids(project, generatedClientDir);

  await generateTsSchema({
    options: {
      file: generatedSchemaFile,
    },
    connectionConfig,
    root,
  });
  changeSchemaToUseIdTypeForUuids(project, generatedSchemaFile);

  await generateQueryFiles({
    options: {
      target: 'ts',
      watch: true, // don't exit, doesn't actually watch
    },
    connectionConfig,
    root,
  });

  await project.save();
})().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

function changeQueryBuilderToUseIdTypeForUuids(
  project: Project,
  generatedClientDir: string,
) {
  // Change $uuid scalar type alias to use ID type instead of string
  const clientStd = project.addSourceFileAtPath(
    `${generatedClientDir}/modules/std.ts`,
  );
  addIdImport(clientStd);
  const uuid = clientStd
    .getChildSyntaxListOrThrow()
    .getFirstChildOrThrow(
      (c) =>
        c.isKind(SyntaxKind.TypeAliasDeclaration) && c.getName() === '$uuid',
    );
  uuid.replaceWithText(uuid.getFullText().replace('string', 'ID'));

  // Change implicit return shapes that are just the id to be ID type.
  const typesystem = project.addSourceFileAtPath(
    `${generatedClientDir}/typesystem.ts`,
  );
  addIdImport(typesystem);
  typesystem.replaceWithText(
    typesystem.getFullText().replaceAll('{ id: string }', '{ id: ID }'),
  );
}

function changeSchemaToUseIdTypeForUuids(
  project: Project,
  generatedSchemaFile: string,
) {
  const schema = project.addSourceFileAtPath(generatedSchemaFile);
  addIdImport(schema);
  schema
    .getChildrenOfKind(SyntaxKind.ModuleDeclaration)
    .find((ns) => ns.getName() === 'std')
    ?.getInterfaceOrThrow('BaseObject')
    .getPropertyOrThrow('"id"')
    .setType('ID');
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

function addIdImport(file: SourceFile) {
  file.insertImportDeclaration(2, {
    namedImports: ['ID'],
    moduleSpecifier: '~/common',
    leadingTrivia: '\n',
    isTypeOnly: true,
  });
}
