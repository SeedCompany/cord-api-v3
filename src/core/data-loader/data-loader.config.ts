import { Injectable } from '@nestjs/common';
import { DataLoaderOptions } from '@seedcompany/data-loader';
import { NotFoundException } from '~/common';
import { ConfigService } from '../config/config.service';

@Injectable()
export class DataLoaderConfig {
  constructor(private readonly config: ConfigService) {}

  create(): DataLoaderOptions<any, any> {
    return {
      // Increase the batching timeframe from the same nodejs frame to 10ms
      batchScheduleFn: (cb) => setTimeout(cb, 10),
      maxBatchSize: 100,
      createError: ({ typeName, cacheKey }) =>
        new NotFoundException(
          `Could not find ${String(typeName)} (${String(cacheKey)})`,
        ),
      cache: !this.config.isCli,
    };
  }
}
