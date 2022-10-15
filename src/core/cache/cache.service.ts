import { Injectable } from '@nestjs/common';
import { DateTime, Duration } from 'luxon';
import { setImmediate } from 'timers';
import { Promisable } from 'type-fest';
import { DurationIn } from '~/common';
import {
  ItemOptions as BackingOptions,
  CacheBackingService,
} from './backing.interface';

@Injectable()
export class CacheService {
  private readonly refreshing = new Set();

  constructor(private readonly backing: CacheBackingService) {}

  item<T>(key: string, options?: ItemOptions): CacheItem<T> {
    return new CacheItem<T>(key, this, options);
  }

  async get<T>(key: string): Promise<T | undefined> {
    return await this.backing.get(key);
  }

  async set(key: string, value: unknown, options: ItemOptions = {}) {
    let ttl = options.ttl ? Duration.from(options.ttl) : undefined;
    // Treat 0 as infinite
    ttl = ttl?.toMillis() === 0 ? undefined : ttl;
    const resolved: BackingOptions = { ttl };

    await Promise.all([
      this.backing.set(key, value, resolved),
      this.setMeta(key, resolved),
    ]);
  }

  async delete(key: string) {
    await Promise.all([
      this.backing.delete(key),
      this.backing.delete(key + ':meta'),
    ]);
  }

  async getOrCalculate<T>(options: CachableCalculationOptions<T>): Promise<T> {
    const { key, calculate, backgroundRefreshAfter, ...cacheOptions } = options;
    const [prev, meta] = await Promise.all([
      this.get<T>(key),
      options.backgroundRefreshAfter ? this.getMeta(key) : undefined,
    ]);
    if (!prev) {
      const now = await calculate();
      await this.set(key, now, cacheOptions); // TODO maybe don't await?
      return now;
    }
    if (!backgroundRefreshAfter) {
      return prev;
    }
    const staleAt = DateTime.now()
      .plus(Duration.from(backgroundRefreshAfter))
      .toMillis();
    if ((!meta || staleAt > meta.createdAt) && !this.refreshing.has(key)) {
      this.refreshing.add(key);
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      setImmediate(async () => {
        const next = await calculate();
        await this.set(key, next, cacheOptions);
        this.refreshing.delete(key);
      });
    }

    return prev;
  }

  async getMeta(key: string) {
    return await this.get<ItemMetadata>(key + ':meta');
  }

  private async setMeta(key: string, options: BackingOptions) {
    await this.backing.set<ItemMetadata>(
      key + ':meta',
      { createdAt: Date.now() },
      options
    );
  }
}

export interface ItemOptions {
  /**
   * Time to live - duration that an item is cached before it is deleted.
   */
  ttl?: DurationIn;
}

export interface CachableCalculationOptions<T> extends ItemOptions {
  key: string;

  calculate: () => Promisable<T>;

  /**
   * Run the calculation in the background to freshen cache while returning
   * the cached value, if the item was created this far in the past.
   */
  backgroundRefreshAfter?: DurationIn;
}

interface ItemMetadata {
  createdAt: Milliseconds;
}

export class CacheItem<T> {
  /**
   * @internal
   */
  constructor(
    readonly key: string,
    private readonly service: CacheService,
    private readonly options: ItemOptions = {}
  ) {}

  async get(): Promise<T | undefined> {
    return await this.service.get<T>(this.key);
  }

  async set(value: T) {
    await this.service.set(this.key, value, this.options);
  }

  async delete() {
    await this.service.delete(this.key);
  }

  async getOrCalculate(
    options: Omit<CachableCalculationOptions<T>, 'key'> | (() => Promisable<T>)
  ): Promise<T> {
    return await this.service.getOrCalculate({
      ...this.options,
      ...(typeof options === 'function' ? { calculate: options } : options),
      key: this.key,
    });
  }
}

type Milliseconds = number;
