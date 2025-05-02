import type * as ts from 'typescript';
import {
  ResourceReadonlyVisitor,
  ResourceVisitor,
  // @ts-expect-error the .cts extension is ok and needed for this one spot.
  // This allows Nest CLI to CJS load it via ts-node
} from './resources.visitor.cts';

const visitor = new ResourceVisitor();

// For ts-patch
// eslint-disable-next-line import/no-default-export
export default function (program: ts.Program) {
  return before(undefined, program);
}

// For Nest CLI
export { ResourceReadonlyVisitor as ReadonlyVisitor };
export const before = (_: unknown, program: ts.Program) => {
  return (ctx: ts.TransformationContext) => {
    return (sf: ts.SourceFile) => {
      return visitor.visit(sf, ctx, program);
    };
  };
};
