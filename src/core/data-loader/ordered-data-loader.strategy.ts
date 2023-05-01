import { DataLoaderOptions } from '@seedcompany/data-loader';
import { ID } from '~/common';
import { SessionAwareLoaderStrategy } from './session-aware-loader.strategy';

/**
 * @deprecated Use SessionAwareLoaderStrategy instead.
 */
export abstract class OrderedNestDataLoader<
  T,
  Key = ID,
  CachedKey = Key,
> extends SessionAwareLoaderStrategy<T, Key, CachedKey> {
  getOptions(): DataLoaderOptions<T, Key, CachedKey> {
    return {};
  }
}
