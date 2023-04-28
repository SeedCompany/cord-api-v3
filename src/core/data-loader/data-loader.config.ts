import { Injectable } from '@nestjs/common';
import { DataLoaderOptions } from '@seedcompany/data-loader';
import { NotFoundException } from '~/common';

@Injectable()
export class DataLoaderConfig {
  create(): DataLoaderOptions<any, any> {
    return {
      // Increase the batching timeframe from the same nodejs frame to 10ms
      batchScheduleFn: (cb) => setTimeout(cb, 10),
      maxBatchSize: 100,
      createError: ({ typeName, cacheKey }) =>
        new NotFoundException(
          `Could not find ${String(typeName)} (${String(cacheKey)})`,
        ),
    };
  }
}
