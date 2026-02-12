import { Injectable } from '@nestjs/common';
import {
  // eslint-disable-next-line @seedcompany/no-restricted-imports
  type DataLoaderOptions,
  // eslint-disable-next-line @seedcompany/no-restricted-imports
  lifetimeIdFromExecutionContext,
} from '@seedcompany/data-loader';
import { NotFoundException } from '~/common';
import { ConfigService } from '~/core/config';
import { Identity } from '../authentication';

@Injectable()
export class DataLoaderConfig {
  constructor(
    private readonly config: ConfigService,
    private readonly identity: Identity,
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
        const session = this.identity.currentMaybe;
        if (session) return session;

        return lifetimeIdFromExecutionContext(context);
      },
      cache: !this.config.isCli,
    };
  }
}
