import { Inject } from '@nestjs/common';
import { Except } from 'type-fest';
import { CachableCalculationOptions, CacheService } from './cache.service';

const CacheKey = Symbol('CacheService');

type CacheOptions = Except<CachableCalculationOptions<unknown>, 'calculate'>;
type CacheOptionsOrFn<Args extends any[]> =
  | CacheOptions
  | ((...args: Args) => CacheOptions);

/**
 * Cache result of this method.
 *
 * This is just a shortcut for calling {@link CacheService.getOrCalculate}.
 *
 * @example
 * ```
 * @Cache({ key: 'foo-bar', ttl: { minutes: 5 } })
 * async fooBar() { ... }
 * ```
 *
 * @example
 * However, you will probably need to cache based on the args given, so:
 * ```
 * @Cache((id: string, year: number) => ({
 *   key: `foo-bar:${id}-${year}`,
 *   ttl: { minutes: 5 },
 * }))
 * async fooBar(id: string, year: number) { ... }
 *
 * Yes unfortunately you have to type the args twice.
 * ```
 */
export const Cache =
  <Args extends any[]>(options: CacheOptionsOrFn<Args>) =>
  <Result>(
    target: any,
    methodName: string | symbol,
    descriptor: TypedPropertyDescriptor<
      (this: { [CacheKey]: CacheService }, ...args: Args) => Promise<Result>
    >
  ) => {
    // Use property-based injection to get access to the Cache object at a known location.
    if (target[CacheKey] === undefined) {
      Inject(CacheService)(target, CacheKey);
      // Ensure prop injection is only done once, by having
      // subsequent methods in this class will skip this if statement.
      target[CacheKey] = null;
    }

    // Wrap the method
    const origMethod = descriptor.value!;
    descriptor.value = async function (...args) {
      return await this[CacheKey].getOrCalculate({
        ...(typeof options === 'function' ? options(...args) : options),
        calculate: () => origMethod.apply(this, args),
      });
    };
  };
