// eslint-disable-next-line no-restricted-imports -- it's ok in this folder
import DataLoaderLib from 'dataloader';
import { identity, startCase } from 'lodash';
import { GqlContextType, ID, NotFoundException } from '../../common';
import { anonymousSession } from '../../common/session';
import { NoSessionException } from '../../components/authentication/no-session.exception';
import { DataLoader, NestDataLoader } from './loader.decorator';

export interface OrderedNestDataLoaderOptions<T, Key = ID, CachedKey = Key>
  extends DataLoaderLib.Options<Key, T, CachedKey> {
  /**
   * How should the object be identified?
   * A function to do so or a property key. Defaults to `id`
   */
  propertyKey?: keyof T | ((obj: T) => Key);

  /**
   * How to describe the object in errors.
   * Defaults to the class name minus loader suffix
   */
  typeName?: string;
}

/**
 * Shortcut to reference options of class name instead of having to duplicate
 * these generic values.
 */
export type LoaderOptionsOf<Factory> = Factory extends NestDataLoader<
  infer T,
  infer Key,
  infer CachedKey
>
  ? OrderedNestDataLoaderOptions<T, Key, CachedKey>
  : never;

export abstract class OrderedNestDataLoader<T, Key = ID, CachedKey = Key>
  implements NestDataLoader<T, Key, CachedKey>
{
  private context: GqlContextType;

  abstract loadMany(
    keys: readonly Key[]
  ): Promise<ReadonlyArray<T | { key: Key; error: Error }>>;

  getOptions(): OrderedNestDataLoaderOptions<T, Key, CachedKey> {
    return {
      // Increase the batching timeframe from the same nodejs frame to 10ms
      batchScheduleFn: (cb) => setTimeout(cb, 10),
      maxBatchSize: 100,
    };
  }

  get session() {
    const session = this.context.session;
    if (!session) {
      throw new NoSessionException();
    }
    return anonymousSession(session);
  }

  generateDataLoader(context: GqlContextType) {
    this.context = context;
    return this.createLoader(this.getOptions());
  }

  protected createLoader({
    typeName,
    propertyKey,
    ...options
  }: OrderedNestDataLoaderOptions<T, Key, CachedKey>): DataLoader<
    T,
    Key,
    CachedKey
  > {
    typeName ??= startCase(
      this.constructor.name.replace('Loader', '')
    ).toLowerCase();

    const getKey =
      typeof propertyKey === 'function'
        ? propertyKey
        : (obj: T) => obj[(propertyKey ?? 'id') as keyof T] as unknown as Key;
    const getCacheKey: (key: Key) => CachedKey = options.cacheKeyFn ?? identity;

    const batchFn: DataLoaderLib.BatchLoadFn<Key, T> = async (keys) => {
      const docs = await this.loadMany(keys);

      // Put documents (docs) into a map where key is a document's ID or some
      // property (prop) of a document and value is a document.
      const docsMap = new Map();
      docs.forEach((doc) => {
        if ('error' in doc && doc.error instanceof Error) {
          docsMap.set(getCacheKey(doc.key), doc.error);
        } else {
          docsMap.set(getCacheKey(getKey(doc as T)), doc);
        }
      });
      // Loop through the keys and for each one retrieve proper document. For not
      // existing documents generate an error.
      return keys.map((key) => {
        const cacheKey = getCacheKey(key);
        return (
          docsMap.get(cacheKey) ||
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          new NotFoundException(`Could not find ${typeName} (${cacheKey})`)
        );
      });
    };

    const loader = new DataLoaderLib<Key, T, CachedKey>(
      batchFn,
      options
    ) as DataLoader<T, Key, CachedKey>;

    loader.primeAll = (items) => {
      for (const item of items) {
        loader.prime(getKey(item), item);
      }
      return loader;
    };

    return loader;
  }
}
