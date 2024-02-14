import { Client } from 'edgedb';
import { Directory, SourceFile } from 'ts-morph';
import { ScalarInfo } from '../codecs';
import { HydratorMap } from './find-hydration-shapes';

export interface GeneratorParams {
  client: Client;
  root: Directory;
  edgedbDir: Directory;
  hydrators: HydratorMap;
  errors: Error[];
}

export function addCustomScalarImports(
  file: SourceFile,
  scalars: Iterable<ScalarInfo>,
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

export const toFqn = (type: string) =>
  type.includes(':') ? type : `default::${type}`;
