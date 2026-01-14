import {
  type DataLoaderOptions,
  type DataLoaderStrategy,
} from '@seedcompany/data-loader';

export type LoaderOptionsOf<Strategy, CachedKey = unknown> =
  Strategy extends Pick<DataLoaderStrategy<infer T, infer Key, any>, 'loadMany'>
    ? DataLoaderOptions<T, Key, CachedKey>
    : never;
