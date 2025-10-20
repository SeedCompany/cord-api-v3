import {
  GraphQLLiveDirective,
  isLiveQueryOperationDefinitionNode,
} from '@n1ru4l/graphql-live-query';
import { applyLiveQueryJSONDiffPatchGenerator } from '@n1ru4l/graphql-live-query-patch-jsondiffpatch';
import { InMemoryLiveQueryStore } from '@n1ru4l/in-memory-live-query-store';
import { getOperationAST, GraphQLSchema } from 'graphql';
import { AsyncLocalStorage } from 'node:async_hooks';
import { CleanUpLongLivedConnectionsOnShutdownPlugin } from '../graphql/clean-up-long-lived-connections-on-shutdown.plugin';
import { Plugin } from '../graphql/plugin.decorator';
import { NoLiveMixedWithDeferStreamRule } from './no-live-mixed-with-defer-stream.rule';

@Plugin(
  // Later, so wrapping is at the outer layer, so that this execute() handles
  // the single -> iterable transformation.
  // This keeps other plugins operating like an execute() is a single time event.
  // It is just that this plugin then calls that multiple times when invalidation happens.
  1,
)
export class LiveQueryPlugin {
  constructor(
    private readonly store: InMemoryLiveQueryStore,
    private readonly cleanUpPlugin: CleanUpLongLivedConnectionsOnShutdownPlugin,
  ) {}

  onSchemaChange: Plugin['onSchemaChange'] = ({
    schema: raw,
    replaceSchema,
  }) => {
    const schema: GraphQLSchema = raw;
    if (schema.getDirective('live')) {
      return;
    }
    const next = new GraphQLSchema({
      ...schema.toConfig(),
      directives: [...schema.getDirectives(), GraphQLLiveDirective],
    });
    replaceSchema(next);
  };

  onValidate: Plugin['onValidate'] = ({ addValidationRule }) => {
    addValidationRule(NoLiveMixedWithDeferStreamRule);
  };

  onExecute: Plugin['onExecute'] = ({ args, executeFn, setExecuteFn }) => {
    const op = getOperationAST(args.document, args.operationName);
    const isLive = op
      ? isLiveQueryOperationDefinitionNode(op, args.variableValues)
      : false;
    if (!isLive) {
      return;
    }

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

    this.cleanUpPlugin.track('live query', args);
  };
}
