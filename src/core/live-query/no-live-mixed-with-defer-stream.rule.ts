import { getLiveDirectiveNode } from '@n1ru4l/graphql-live-query';
import { getOperationAST, GraphQLError, type ValidationRule } from 'graphql';

/**
 * Upstream has an issue, so this is my version that is fixed.
 * @see https://github.com/n1ru4l/graphql-live-query/issues/1031
 */
export const NoLiveMixedWithDeferStreamRule: ValidationRule = (context) => ({
  // Changed from upstream to check at doc level, then go down manually to
  // Operation to check @live directive.
  // This allows skipping the entire document, including all flat fragment definitions.
  // eslint-disable-next-line @typescript-eslint/naming-convention
  Document(doc) {
    const op = getOperationAST(doc);
    if (op == null) {
      return false;
    }
    if (getLiveDirectiveNode(op) == null) {
      return false;
    }
    return;
  },
  // eslint-disable-next-line @typescript-eslint/naming-convention
  Directive(directive) {
    if (directive.name.value === 'defer' || directive.name.value === 'stream') {
      context.reportError(
        new GraphQLError(
          `Cannot mix "@${directive.name.value}" with "@live".`,
          directive.name,
        ),
      );
    }
  },
});
