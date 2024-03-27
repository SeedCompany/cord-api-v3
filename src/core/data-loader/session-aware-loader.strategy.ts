import { Inject } from '@nestjs/common';
import { DataLoaderStrategy } from '@seedcompany/data-loader';
import { ID } from '~/common';
import { sessionFromContext } from '~/common/session';
import { GqlContextHost } from '../graphql';

export abstract class SessionAwareLoaderStrategy<T, Key = ID, CachedKey = Key>
  implements DataLoaderStrategy<T, Key, CachedKey>
{
  abstract loadMany(
    keys: readonly Key[],
  ): Promise<ReadonlyArray<T | { key: Key; error: Error }>>;

  @Inject(GqlContextHost)
  private readonly contextHost: GqlContextHost;

  get session() {
    return sessionFromContext(this.contextHost.context);
  }
}
