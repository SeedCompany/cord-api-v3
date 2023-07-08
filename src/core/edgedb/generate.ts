/* eslint-disable import/first,import-helpers/order-imports,no-console */
import { adapter } from 'edgedb';
import { SCALAR_CODECS } from 'edgedb/dist/codecs/codecs';
import { KNOWN_TYPENAMES } from 'edgedb/dist/codecs/consts';

const actualGenCommand = 'yarn edgedb:gen';

interface CustomScalar {
  module: string;
  type: string;
  ts: string;
  path: string;
}
const customScalars = new Map(
  (
    [
      { module: 'std', type: 'uuid', ts: 'ID', path: '~/common' },
      { module: 'std', type: 'datetime', ts: 'DateTime', path: 'luxon' },
      {
        module: 'cal',
        type: 'local_date',
        ts: 'CalendarDate',
        path: '~/common',
      },
    ] satisfies CustomScalar[]
  ).map((s) => [s.ts, s]),
);

const customScalarImportCheck = RegExp(
  `import type {.*(${[...customScalars.keys()].join('|')}).*} from "edgedb";`,
);
const pathsNeedingScalarImportFix = new Set<string>();

// Swap out references to npx for our actual yarn command before writing to disk
adapter.fs.writeFile = new Proxy(adapter.fs.writeFile, {
  apply(target: any, thisArg: any, [path, content]: any[]) {
    const patched = content.replace(
      /([`'])npx @edgedb\/generate [\w-]+[`']/,
      `$1${actualGenCommand}$1`,
    );
    // Check if the file references our ID type to fix import later.
    if (
      !path.includes('generated-client') &&
      content.match(customScalarImportCheck)
    ) {
      pathsNeedingScalarImportFix.add(path);
    }
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
import { scalarToLiteralMapping } from '@edgedb/generate/dist/genutil';
import { runInterfacesGenerator as generateTsSchema } from '@edgedb/generate/dist/interfaces';
import { generateQueryFiles } from '@edgedb/generate/dist/queries';
import { groupBy } from 'lodash';
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

  changeScalarCodecsToOurCustomTypes();

  const qbOptions = {
    out: generatedClientDir,
    updateIgnoreFile: false,
    target: 'ts',
    forceOverwrite: true,
  } as const;
  // Don't allow this function to change any properties
  // i.e., don't re-enable updateIgnoreFile.
  // We don't want to check that every time.
  // Their ignore file logic also breaks the docker build.
  const qbOptionImmutable = new Proxy(qbOptions, {
    set: () => true,
  });
  await generateQueryBuilder({
    options: qbOptionImmutable,
    connectionConfig,
    root,
  });
  changeCustomScalarsInQueryBuilder(project, generatedClientDir);
  changeImplicitIDTypeToOurCustomScalar(project, generatedClientDir);

  await generateTsSchema({
    options: {
      file: generatedSchemaFile,
    },
    connectionConfig,
    root,
  });
  addCustomScalarImports(
    project.addSourceFileAtPath(generatedSchemaFile),
    customScalars.values(),
  );

  await generateQueryFiles({
    options: {
      target: 'ts',
      watch: true, // don't exit, doesn't actually watch
    },
    connectionConfig,
    root,
  });
  fixCustomScalarImportsInGeneratedEdgeqlFiles(project);

  await project.save();

  console.log('Done!');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

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
  for (const scalars of Object.values(
    groupBy([...customScalars.values()], (s) => s.module),
  )) {
    const moduleFile = project.addSourceFileAtPath(
      `${generatedClientDir}/modules/${scalars[0]!.module}.ts`,
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
    `${generatedClientDir}/typesystem.ts`,
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
