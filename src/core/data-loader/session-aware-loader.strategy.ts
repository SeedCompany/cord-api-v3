import { Inject } from '@nestjs/common';
import { type DataLoaderStrategy } from '@seedcompany/data-loader';
import { type ID, type Session } from '~/common';
import type { AuthenticationService } from '../../components/authentication';
import { SessionHost } from '../../components/authentication/session.host';
import { ConfigService } from '../config/config.service';

export abstract class SessionAwareLoaderStrategy<T, Key = ID, CachedKey = Key>
  implements DataLoaderStrategy<T, Key, CachedKey>
{
  abstract loadMany(
    keys: readonly Key[],
  ): Promise<ReadonlyArray<T | { key: Key; error: Error }>>;

  @Inject(SessionHost)
  private readonly sessionHost: SessionHost;

  @Inject(ConfigService)
  private readonly config: ConfigService;

  @Inject('AUTHENTICATION')
  private readonly auth: AuthenticationService & {};

  get session(): Session {
    if (this.config.isCli) {
      return this.auth.lazySessionForRootUser();
    }

    return this.sessionHost.current;
  }
}
