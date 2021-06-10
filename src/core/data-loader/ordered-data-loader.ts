import * as DataLoader from 'dataloader';
import { ID } from '../../common';
import { NestDataLoader } from './loader.decorator';

export interface OrderedNestDataLoaderOptions<T, Key = ID> {
  propertyKey?: string;
  query: (keys: readonly Key[]) => Promise<T[]>;
  typeName?: string;
  dataloaderConfig?: DataLoader.Options<Key, T>;
}

export abstract class OrderedNestDataLoader<T, Key = ID>
  implements NestDataLoader<T, Key>
{
  protected abstract getOptions: () => OrderedNestDataLoaderOptions<T, Key>;

  generateDataLoader() {
    return this.createLoader(this.getOptions());
  }

  protected createLoader(
    options: OrderedNestDataLoaderOptions<T, Key>
  ): DataLoader<Key, T> {
    const defaultTypeName = this.constructor.name.replace('Loader', '');
    return new DataLoader<Key, T>(async (keys) => {
      return ensureOrder({
        docs: await options.query(keys),
        keys,
        prop: options.propertyKey || 'id',
        error: (keyValue: ID) =>
          `${options.typeName || defaultTypeName} does not exist (${keyValue})`,
      });
    }, options.dataloaderConfig);
  }
}

// https://github.com/graphql/dataloader/issues/66#issuecomment-386252044
const ensureOrder = (options: any) => {
  const {
    docs,
    keys,
    prop,
    error = (key: ID) => `Document does not exist (${key})`,
  } = options;
  // Put documents (docs) into a map where key is a document's ID or some
  // property (prop) of a document and value is a document.
  const docsMap = new Map();
  docs.forEach((doc: any) => docsMap.set(doc[prop], doc));
  // Loop through the keys and for each one retrieve proper document. For not
  // existing documents generate an error.
  return keys.map((key: ID) => {
    return (
      docsMap.get(key) ||
      new Error(typeof error === 'function' ? error(key) : error)
    );
  });
};
