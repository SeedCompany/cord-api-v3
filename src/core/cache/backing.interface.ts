import { Duration } from 'luxon';

export abstract class CacheBackingService {
  abstract get<T>(key: string): Promise<T | undefined>;
  abstract set<T>(key: string, value: T, options: ItemOptions): Promise<void>;
  abstract delete(key: string): Promise<void>;
  abstract remainingTtl(key: string): Promise<number>;
}

export interface ItemOptions {
  /**
   * Time to live - duration that an item is cached before it is deleted.
   */
  ttl?: Duration;
}
