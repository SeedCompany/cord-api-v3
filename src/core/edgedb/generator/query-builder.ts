import { generateQueryBuilder as runQueryBuilderGenerator } from '@edgedb/generate/dist/edgeql-js.js';
import { groupBy } from '@seedcompany/common';
import { Directory, SyntaxKind } from 'ts-morph';
import { customScalars } from './scalars';
import { addCustomScalarImports, GeneratorParams } from './util';

export async function generateQueryBuilder({
  client,
  root,
  edgedbDir,
}: GeneratorParams) {
  const qbDir = edgedbDir.createDirectory('generated-client');
  await runQueryBuilderGenerator({
    options: {
      out: qbDir.getPath(),
      updateIgnoreFile: false,
      target: 'ts',
      forceOverwrite: true,
    },
    client,
    root: root.getPath(),
  });
  addJsExtensionDeepPathsOfEdgedbLibrary(qbDir);
  changeCustomScalars(qbDir);
  changeImplicitIDType(qbDir);
  allowOrderingByEnums(qbDir);
  mergeDefaultTypesWithModuleNames(qbDir);
}

function addJsExtensionDeepPathsOfEdgedbLibrary(qbDir: Directory) {
  for (const file of qbDir.addSourceFilesAtPaths('*')) {
    const declarations = [
      ...file.getImportDeclarations(),
      ...file.getExportDeclarations(),
    ].filter((d) => d.getModuleSpecifierValue()?.startsWith('edgedb/'));
    for (const decl of declarations) {
      decl.setModuleSpecifier(decl.getModuleSpecifierValue()! + '.js');
    }
  }
}

function changeCustomScalars(qbDir: Directory) {
  // Change $uuid scalar type alias to use ID type instead of string
  for (const scalars of groupBy(customScalars.values(), (s) => s.module)) {
    const moduleFile = qbDir.addSourceFileAtPath(
      `modules/${scalars[0]!.module}.ts`,
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

function changeImplicitIDType(qbDir: Directory) {
  // Change implicit return shapes that are just the id to be ID type.
  const typesystem = qbDir.addSourceFileAtPath(`typesystem.ts`);
  addCustomScalarImports(typesystem, [customScalars.get('ID')!]);
  typesystem.replaceWithText(
    typesystem.getFullText().replaceAll('{ id: string }', '{ id: ID }'),
  );
}

function allowOrderingByEnums(qbDir: Directory) {
  const file = qbDir.getSourceFileOrThrow('select.ts');
  file
    .getTypeAliasOrThrow('OrderByExpr')
    .setType('TypeSet<EnumType | ScalarType | ObjectType>');
  file.fixMissingImports();
}

function mergeDefaultTypesWithModuleNames(qbDir: Directory) {
  const file = qbDir.getSourceFileOrThrow('index.ts');
  const st = file.getVariableDeclarationOrThrow('ExportDefault');
  const typeText = st.getTypeNodeOrThrow().getFullText();
  const value = st.getInitializerIfKindOrThrow(
    SyntaxKind.ObjectLiteralExpression,
  );
  // Regex is faster here than ts-morph type parsing
  const conflicting = (
    typeText.match(/Omit<typeof _default, (.+)>/)?.[1].split(/ \| /g) ?? []
  ).map((s) => s.slice(1, -1));
  let newTypeText = typeText;
  for (const name of conflicting) {
    newTypeText = newTypeText.replace(
      `typeof _${name}`,
      `typeof _${name} & typeof _default.${name}`,
    );
    value
      .getPropertyOrThrow(`"${name}"`)
      .asKindOrThrow(SyntaxKind.PropertyAssignment)
      .getInitializerOrThrow()
      .replaceWithText(`{ ..._${name}, ..._default.${name} }`);
  }
  st.setType(newTypeText);
}
