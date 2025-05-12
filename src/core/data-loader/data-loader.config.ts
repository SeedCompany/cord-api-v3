import { Injectable } from '@nestjs/common';
import {
  type DataLoaderOptions,
  lifetimeIdFromExecutionContext,
} from '@seedcompany/data-loader';
import { NotFoundException } from '~/common';
import { SessionHost } from '../../components/authentication';
import { ConfigService } from '../config/config.service';

@Injectable()
export class DataLoaderConfig {
  constructor(
    private readonly config: ConfigService,
    private readonly sessionHost: SessionHost,
  ) {}

  create(): DataLoaderOptions<any, any> {
    return {
      // Increase the batching timeframe from the same nodejs frame to 10ms
      batchScheduleFn: (cb) => setTimeout(cb, 10),
      maxBatchSize: 100,
      createError: ({ typeName, cacheKey }) =>
        new NotFoundException(
          `Could not find ${String(typeName)} (${String(cacheKey)})`,
        ),
      getLifetimeId: (context) => {
        // If we have a session, use that as the cache key.
        // It will always be created / scoped within the GQL operation.
        // This ensures the cached data isn't shared between users.
        const session = this.sessionHost.current$.value;
        if (session) return session;

        return lifetimeIdFromExecutionContext(context);
      },
      cache: !this.config.isCli,
    };
  }
}
