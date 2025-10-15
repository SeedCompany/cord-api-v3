import { NoLiveMixedWithDeferStreamRule } from '@n1ru4l/graphql-live-query';
import { applyLiveQueryJSONDiffPatchGenerator } from '@n1ru4l/graphql-live-query-patch-jsondiffpatch';
import { InMemoryLiveQueryStore } from '@n1ru4l/in-memory-live-query-store';
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
    addValidationRule(NoLiveMixedWithDeferStreamRule);
  };

  onExecute: Plugin['onExecute'] = ({ executeFn, setExecuteFn }) => {
    const wrapped = this.store.makeExecute(executeFn);
    setExecuteFn((...args) =>
      applyLiveQueryJSONDiffPatchGenerator(wrapped(...args)),
    );
  };
}
