import {
  DataLoaderOptions as BaseOptions,
  DataLoaderStrategy,
} from '@seedcompany/data-loader';
import { ID } from '~/common';

/**
 * @deprecated
 */
export type OrderedNestDataLoaderOptions<
  T,
  Key = ID,
  CachedKey = Key,
> = DataLoaderOptions<T, Key, CachedKey>;

// Defaults Key to ID.
export type DataLoaderOptions<T, Key = ID, CachedKey = Key> = BaseOptions<
  T,
  Key,
  CachedKey
>;

export type LoaderOptionsOf<
  Strategy,
  CachedKey = unknown,
> = Strategy extends Pick<
  DataLoaderStrategy<infer T, infer Key, any>,
  'loadMany'
>
  ? DataLoaderOptions<T, Key, CachedKey>
  : never;
