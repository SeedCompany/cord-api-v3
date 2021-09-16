// eslint-disable-next-line no-restricted-imports -- it's ok in this folder
import * as DataLoader from 'dataloader';
import { startCase } from 'lodash';
import { GqlContextType, ID, NotFoundException } from '../../common';
import { anonymousSession } from '../../common/session';
import { NoSessionException } from '../../components/authentication/no-session.exception';
import { NestDataLoader } from './loader.decorator';

export interface OrderedNestDataLoaderOptions<T, Key = ID> {
  /**
   * How should the object be identified?
   * A property key. Defaults to `id`
   */
  propertyKey?: keyof T;

  /**
   * How to describe the object in errors.
   * Defaults to the class name minus loader suffix
   */
  typeName?: string;

  dataloaderConfig?: DataLoader.Options<Key, T>;
}

export abstract class OrderedNestDataLoader<T, Key = ID>
  implements NestDataLoader<T, Key>
{
  private context: GqlContextType;

  abstract loadMany(keys: readonly Key[]): Promise<readonly T[]>;

  getOptions(): OrderedNestDataLoaderOptions<T, Key> {
    return {
      dataloaderConfig: {
        // Increase the batching timeframe from the same nodejs frame to 10ms
        batchScheduleFn: (cb) => setTimeout(cb, 10),
      },
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

  protected createLoader(
    options: OrderedNestDataLoaderOptions<T, Key>
  ): DataLoader<Key, T> {
    const typeName =
      options.typeName ??
      startCase(this.constructor.name.replace('Loader', '')).toLowerCase();

    const getKey = (obj: T) => obj[(options.propertyKey ?? 'id') as keyof T];

    const batchFn: DataLoader.BatchLoadFn<Key, T> = async (keys) => {
      const docs = await this.loadMany(keys);

      // Put documents (docs) into a map where key is a document's ID or some
      // property (prop) of a document and value is a document.
      const docsMap = new Map();
      docs.forEach((doc: T) => docsMap.set(getKey(doc), doc));
      // Loop through the keys and for each one retrieve proper document. For not
      // existing documents generate an error.
      return keys.map(
        (key) =>
          docsMap.get(key) ||
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          new NotFoundException(`Could not find ${typeName} (${key})`)
      );
    };

    return new DataLoader<Key, T>(batchFn, options.dataloaderConfig);
  }
}
