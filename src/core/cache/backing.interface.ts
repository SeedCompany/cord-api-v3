import { Duration } from 'luxon';

export abstract class CacheBackingService {
  abstract get<T>(key: string): Promise<T | undefined>;
  abstract set<T>(key: string, value: T, options: ItemOptions): Promise<void>;
  abstract delete(key: string): Promise<void>;
}

export interface ItemOptions {
  /**
   * Time to live - duration that an item is cached before it is deleted.
   */
  ttl?: Duration;
}
