/** @import ts from 'typescript'; */
import { ResourceVisitor } from './resources.visitor.js';

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
export { ResourceVisitor as ReadonlyVisitor };
/**
 * @param _ {*}
 * @param program {ts.Program}
 * @returns {(ctx: ts.TransformationContext) => (sf: ts.SourceFile) => ts.Node}
 */
export const before = (_, program) => (ctx) => (sf) => {
  return visitor.visit(program, sf, ctx);
};
