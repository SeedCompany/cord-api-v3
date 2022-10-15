import { CacheBackingService, ItemOptions } from './backing.interface';

export class InMemoryCache extends CacheBackingService {
  private readonly cache = new Map<string, string>();
  private readonly timers = new Map<string, NodeJS.Timeout>();

  async get<T>(key: string) {
    const val = this.cache.get(key);
    if (val === undefined) {
      return undefined;
    }
    return JSON.parse(val) as T;
  }

  async set<T>(key: string, value: T, options: ItemOptions) {
    this.cache.set(key, JSON.stringify(value));
    const oldTimer = this.timers.get(key);
    if (oldTimer) {
      clearTimeout(oldTimer);
    }
    if (options.ttl) {
      const handler = () => this.cache.delete(key);
      const timeout = options.ttl.toMillis();
      this.timers.set(key, setTimeout(handler, timeout));
    }
  }

  async delete(key: string) {
    this.cache.delete(key);
  }
}
