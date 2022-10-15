import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { CacheBackingService, ItemOptions } from './backing.interface';

@Injectable()
export class RedisCache extends CacheBackingService {
  constructor(private readonly redis: Redis) {
    super();
  }

  async get<T>(key: string) {
    const val = await this.redis.get(key);
    if (val == null) {
      return undefined;
    }
    return JSON.parse(val) as T;
  }

  async set<T>(key: string, value: T, options: ItemOptions) {
    const encoded = JSON.stringify(value);
    if (options.ttl) {
      await this.redis.set(key, encoded, 'PX', options.ttl.toMillis());
    } else {
      await this.redis.set(key, encoded);
    }
  }

  async delete(key: string) {
    await this.redis.del(key);
  }
}
