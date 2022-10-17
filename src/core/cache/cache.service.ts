import { Injectable } from '@nestjs/common';
import { Duration } from 'luxon';
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

  async get<T>(key: string, options: ItemOptions = {}): Promise<T | undefined> {
    return await this.backing.get<T>(key, this.resolveOptions(options));
  }

  async set(key: string, value: unknown, options: ItemOptions = {}) {
    await this.backing.set(key, value, this.resolveOptions(options));
  }

  private resolveOptions(options: ItemOptions): BackingOptions {
    const { ttl: rawTtl, ...rest } = options;
    let ttl = rawTtl ? Duration.from(rawTtl) : undefined;
    // Treat 0 as infinite
    ttl = ttl?.toMillis() === 0 ? undefined : ttl;
    return { ttl, ...rest };
  }

  async delete(key: string) {
    await Promise.all([
      this.backing.delete(key),
      this.backing.delete(key + ':meta'),
    ]);
  }

  async getOrCalculate<T>(options: CachableCalculationOptions<T>): Promise<T> {
    const { key, calculate, backgroundRefreshTtl, ...cacheOptions } = options;
    const [prev, remainingTtl] = await Promise.all([
      this.get<T>(key),
      options.backgroundRefreshTtl ? this.backing.remainingTtl(key) : undefined,
    ]);
    if (!prev) {
      const now = await calculate();
      await this.set(key, now, cacheOptions); // TODO maybe don't await?
      return now;
    }
    if (!backgroundRefreshTtl || !remainingTtl) {
      return prev;
    }
    const shouldRefresh =
      Duration.fromMillis(remainingTtl) < Duration.from(backgroundRefreshTtl);
    if (shouldRefresh && !this.refreshing.has(key)) {
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
}

export interface ItemOptions extends Pick<BackingOptions, 'refreshTtlOnGet'> {
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
   * the cached value, if the item is this close to expiring.
   */
  backgroundRefreshTtl?: DurationIn;
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

  async get(optionsOverride?: Partial<ItemOptions>): Promise<T | undefined> {
    return await this.service.get<T>(this.key, {
      ...this.options,
      ...optionsOverride,
    });
  }

  async set(value: T, optionsOverride?: Partial<ItemOptions>) {
    await this.service.set(this.key, value, {
      ...this.options,
      ...optionsOverride,
    });
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
