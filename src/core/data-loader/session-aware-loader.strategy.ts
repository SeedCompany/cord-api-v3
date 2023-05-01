import { Inject } from '@nestjs/common';
import { DataLoaderStrategy } from '@seedcompany/data-loader';
import { ID } from '~/common';
import { NoSessionException } from '../../components/authentication/no-session.exception';
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
    const session = this.contextHost.context.session;
    if (!session) {
      throw new NoSessionException();
    }
    return session;
  }
}
