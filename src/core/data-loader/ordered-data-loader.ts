import * as DataLoader from 'dataloader';
import { GqlContextType, ID } from '../../common';
import { anonymousSession } from '../../common/session';
import { NoSessionException } from '../../components/authentication/no-session.exception';
import { NestDataLoader } from './loader.decorator';

export interface OrderedNestDataLoaderOptions<T, Key = ID> {
  propertyKey?: string;
  typeName?: string;
  dataloaderConfig?: DataLoader.Options<Key, T>;
}

export abstract class OrderedNestDataLoader<T, Key = ID>
  implements NestDataLoader<T, Key>
{
  private context: GqlContextType;

  abstract loadMany(keys: readonly Key[]): Promise<readonly T[]>;

  getOptions(): OrderedNestDataLoaderOptions<T, Key> {
    return {};
  }

  get session() {
    const session = this.context.request.session;
    if (!session) {
      throw new NoSessionException();
    }
    return anonymousSession(session);
  }

  generateDataLoader(context: GqlContextType) {
    this.context = context;
    return this.createLoader(this.getOptions());
  }

  protected createLoader(
    options: OrderedNestDataLoaderOptions<T, Key>
  ): DataLoader<Key, T> {
    const defaultTypeName = this.constructor.name.replace('Loader', '');
    return new DataLoader<Key, T>(async (keys) => {
      return ensureOrder({
        docs: await this.loadMany(keys),
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
    error = (key: ID) => `Node does not exist (${key})`,
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
