import { DataLoaderOptions } from '@seedcompany/data-loader';
import { ID, NotFoundException } from '~/common';
import { SessionAwareLoaderStrategy } from './session-aware-loader.strategy';

/**
 * A loader that will load each item one by one.
 * This is not ideal because it will make at least N requests to DB instead of 1.
 * Using this is only encouraged to adopt the DataLoader pattern, which can provide
 * caching even without batching.
 */
export abstract class SingleItemLoader<
  T,
  Key = ID,
> extends SessionAwareLoaderStrategy<T, Key> {
  abstract loadOne(key: Key): Promise<T>;

  async loadMany(keys: readonly Key[]): Promise<readonly T[]> {
    const items = await Promise.all(
      keys.map(async (key): Promise<T | readonly []> => {
        try {
          return await this.loadOne(key);
        } catch (e) {
          if (e instanceof NotFoundException) {
            return [] as const;
          }
          throw e;
        }
      }),
    );
    return items.flat() as T[];
  }

  getOptions(): DataLoaderOptions<T, Key> {
    return {
      // Batching is worthless here since we load each item individually anyways
      // This skips the wait time and fires immediately.
      batch: false,
    };
  }
}
