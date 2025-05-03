/** @import ts from 'typescript'; */
import {
  ResourceReadonlyVisitor,
  ResourceVisitor,
} from './resources.visitor.js';

const visitor = new ResourceVisitor();

/**
 * For ts-patch
 * @param program {ts.Program}
 * @returns {function(ts.TransformationContext): function(ts.SourceFile): ts.Node}
 */
// eslint-disable-next-line import/no-default-export
export default function (program) {
  return before(undefined, program);
}

// For Nest CLI
export { ResourceReadonlyVisitor as ReadonlyVisitor };
/**
 * @param _ {*}
 * @param program {ts.Program}
 * @returns {(ctx: ts.TransformationContext) => (sf: ts.SourceFile) => ts.Node}
 */
export const before = (_, program) => {
  return (ctx) => {
    return (sf) => {
      return visitor.visit(sf, ctx, program);
    };
  };
};
