import { Inject } from '@nestjs/common';
import { DataLoaderStrategy } from '@seedcompany/data-loader';
import { ID, Session } from '~/common';
import { sessionFromContext } from '~/common/session';
import type { AuthenticationService } from '../../components/authentication';
import { ConfigService } from '../config/config.service';
import { GqlContextHost } from '../graphql';

export abstract class SessionAwareLoaderStrategy<T, Key = ID, CachedKey = Key>
  implements DataLoaderStrategy<T, Key, CachedKey>
{
  abstract loadMany(
    keys: readonly Key[],
  ): Promise<ReadonlyArray<T | { key: Key; error: Error }>>;

  @Inject(GqlContextHost)
  private readonly contextHost: GqlContextHost;

  @Inject(ConfigService)
  private readonly config: ConfigService;

  @Inject('AUTHENTICATION')
  private readonly auth: AuthenticationService & {};

  get session(): Session {
    if (this.config.isCli) {
      return this.auth.lazySessionForRootUser();
    }

    return sessionFromContext(this.contextHost.context);
  }
}
