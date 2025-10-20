import { DataLoaderContext } from '@seedcompany/data-loader';
import { Identity } from '../authentication';
import { Plugin } from './plugin.decorator';

@Plugin()
export class DataLoadersInSubscriptionPlugin {
  constructor(
    private readonly identity: Identity,
    private readonly dataLoaderContext: DataLoaderContext,
  ) {}

  /**
   * Reset the data loader cache after each subscription event.
   */
  onSubscribe: Plugin['onSubscribe'] = () => ({
    onSubscribeResult: ({ args }) => {
      /**
       * This is the same logic we have in
       * {@link DataLoaderConfig.create.getLifetimeId}
       */
      const id = this.identity.currentMaybe ?? args.contextValue;

      const { loaders: loaderMap } = this.dataLoaderContext.forLifetime(id);

      return {
        onNext: async () => {
          // They should all be resolved by this point.
          const loaders = await Promise.all(loaderMap.values());
          for (const loader of loaders) {
            loader.clearAll();
          }
        },
      };
    },
  });

  /**
   * `@stream/@defer` will re-use the same loader cache, which I think makes sense.
   * They're all a part of one load operation, just segmented out to stream results
   * faster to consumers.
   *
   * `@live` shouldn't re-use loader cache as the very nature of it means there
   * has been a cache invalidation.
   * We don't need to do anything specific because it is set up to do the
   * subsequent `execute()` as an entirely new operation.
   */
  // onExecute: Plugin['onExecute'] = () => ({});
}
