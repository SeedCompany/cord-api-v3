import { type Client } from 'gel';
import { type Directory, type SourceFile } from 'ts-morph';
import { type ScalarInfo } from '../codecs';
import { type HydratorMap } from './find-hydration-shapes';

export interface GeneratorParams {
  client: Client;
  root: Directory;
  gelDir: Directory;
  hydrators: HydratorMap;
  errors: Error[];
}

export function addCustomScalarImports(
  file: SourceFile,
  scalars: Iterable<ScalarInfo>,
  index = 2,
  isTypeOnly = true,
) {
  return file.insertImportDeclarations(
    index,
    [...scalars].map((scalar, i) => ({
      isTypeOnly,
      namedImports: [scalar.ts],
      moduleSpecifier: scalar.path,
      leadingTrivia: i === 0 ? '\n' : undefined,
    })),
  );
}

export const toFqn = (type: string) => (type.includes(':') ? type : `default::${type}`);
