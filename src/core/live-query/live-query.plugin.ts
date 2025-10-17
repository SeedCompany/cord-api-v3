import { getLiveDirectiveNode } from '@n1ru4l/graphql-live-query';
import { applyLiveQueryJSONDiffPatchGenerator } from '@n1ru4l/graphql-live-query-patch-jsondiffpatch';
import { InMemoryLiveQueryStore } from '@n1ru4l/in-memory-live-query-store';
import { GraphQLError, type ValidationRule } from 'graphql';
import { AsyncLocalStorage } from 'node:async_hooks';
import { Plugin } from '../graphql/plugin.decorator';

@Plugin(
  // Later, so wrapping is at the outer layer, so that this execute() handles
  // the single -> iterable transformation.
  // This keeps other plugins operating like an execute() is a single time event.
  // It is just that this plugin then calls that multiple times when invalidation happens.
  1,
)
export class LiveQueryPlugin {
  constructor(private readonly store: InMemoryLiveQueryStore) {}

  onValidate: Plugin['onValidate'] = ({ addValidationRule }) => {
    addValidationRule(LiveMixedWithDeferStreamRule);
  };

  onExecute: Plugin['onExecute'] = ({ executeFn, setExecuteFn }) => {
    const runInAsyncScope = AsyncLocalStorage.snapshot();
    const wrapped = this.store.makeExecute((...args) =>
      // IMLQStore must call the original executeFn with the original async scope.
      // Since invalidations (from a sub message of a redis socket) trigger
      // this `executeFn` subsequently to feed the live data to the client.
      runInAsyncScope(executeFn, ...args),
    );
    setExecuteFn((...args) =>
      applyLiveQueryJSONDiffPatchGenerator(wrapped(...args)),
    );
  };
}

/**
 * Upstream has an issue, so this is my version that is fixed.
 * @see https://github.com/n1ru4l/graphql-live-query/issues/1031
 */
const LiveMixedWithDeferStreamRule: ValidationRule = (context) => ({
  // Changed from upstream to check at doc level, then go down manually to
  // Operation to check @live directive.
  // This allows skipping the entire document, including all flat fragment definitions.
  // eslint-disable-next-line @typescript-eslint/naming-convention
  Document(doc) {
    const op = doc.definitions.find(
      (def) => def.kind === 'OperationDefinition',
    );
    if (op == null) {
      return false;
    }
    if (getLiveDirectiveNode(op) == null) {
      return false;
    }
    return;
  },
  // eslint-disable-next-line @typescript-eslint/naming-convention
  Directive(directiveNode) {
    if (
      directiveNode.name.value === 'defer' ||
      directiveNode.name.value === 'stream'
    ) {
      context.reportError(
        new GraphQLError(
          `Cannot mix "@${directiveNode.name.value}" with "@live".`,
          directiveNode.name,
        ),
      );
    }
  },
});
