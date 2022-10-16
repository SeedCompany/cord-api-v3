import LRUCache from 'lru-cache';
import { CacheBackingService, ItemOptions } from './backing.interface';

export class InMemoryCache extends CacheBackingService {
  private readonly cache: LRUCache<string, unknown>;

  constructor(options?: LRUCache.Options<string, unknown>) {
    super();
    this.cache = new LRUCache({
      sizeCalculation,
      maxSize: 2 ** 20 * 30,
      ...options,
    });
  }

  async get<T>(key: string) {
    return this.cache.get<T>(key);
  }

  async remainingTtl(key: string): Promise<number> {
    return this.cache.getRemainingTTL(key);
  }

  async set<T>(key: string, value: T, options: ItemOptions) {
    this.cache.set(key, value, {
      ttl: options.ttl?.toMillis(),
    });
  }

  async delete(key: string) {
    this.cache.delete(key);
  }
}

const sizeCalculation = (item: unknown) => {
  if (typeof item === 'string') {
    return item.length;
  }
  if (typeof item === 'object') {
    return Buffer.byteLength(JSON.stringify(item), 'utf8');
  }
  return 1;
};
