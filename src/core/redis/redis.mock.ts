import { Logger } from '@nestjs/common';
import { cacheable, patchMethod, setInspectOnClass } from '@seedcompany/common';
import type { Redis, RedisCommander, RedisKey, Result } from 'ioredis';
import RedisMock from 'ioredis-mock';
import * as rx from 'rxjs';
import { EMPTY, firstValueFrom } from 'rxjs';
import type { Simplify } from 'type-fest';
import {
  deepNullToUndefined,
  defineJsonModule,
  defineMsgPackModule,
  setLuaInit,
} from './mock-lua';

const debug = Boolean(false);
// eslint-disable-next-line no-restricted-syntax
const logger = debug ? new Logger('redis') : null;

// Add debug logs to BullMQ lua script calls
if (debug) {
  const { Scripts } = await import('bullmq');
  patchMethod(Scripts.prototype, 'execCommand', (base) => async (...args) => {
    Logger.debug(args[1], '=> ...', 'BullScript');
    try {
      const res = await base(...args);
      Logger.debug('... <=', res, 'BullScript');
      return res;
    } catch (e) {
      Logger.error(args[1], e, 'BullScript');
      throw e;
    }
  });
}

type RedisCommands = RedisCommander<{ type: 'default' }>;
type LuaCommands = Simplify<{
  [K in keyof RedisCommands]: RedisCommands[K] extends (
    ...args: infer Params
  ) => Result<infer Return, { type: 'default' }>
    ? (...args: Params) => Return
    : never;
}>;

patchMethod(RedisMock.prototype, '_initCommands', function (baseInit) {
  return function (this: Redis) {
    baseInit();
    const luaCommands: LuaCommands = (this as any).luaCommands;

    // Always ready.
    // Workers hang without this, I'm not sure why.
    this.status = 'ready';

    // BullMQ uses these functions in lua scripts
    // https://github.com/stipsan/ioredis-mock/issues/1143
    setLuaInit(this, logger, (lua) => {
      defineMsgPackModule(lua);
      defineJsonModule(lua);
    });

    // BullMQ uses this to create unique generated job IDs
    // These job IDs are then concatenated to locate other related keys.
    // There is a Lua/JS discrepancy here where that concatenation produces
    // "foo:1.0" instead of "foo:1"
    // Returning the incremented number as a string works around this.
    // And luckily, there aren't any other usages of `incr` that are expecting
    // a number and doing numeric comparison.
    patchMethod(luaCommands, 'incr', (base) => (...args) => {
      const res = base(...args);
      return String(res) as any as number;
    });

    // BullMQ uses this command to trim events stream
    // Stub it to work around this missing functionality.
    luaCommands.xtrim = () => 0;

    // Lua needs nulls returned from redis.call() to be converted to undefined
    // so that they're passed to Lua VM as nil.
    for (const key of Object.keys(luaCommands) as Array<keyof LuaCommands>) {
      patchMethod(luaCommands, key, (base) => (...args) => {
        const res = base(...args);
        logger?.debug(key, ...args, '=>', res);
        return deepNullToUndefined(res);
      });
    }

    /**
     * Fix lua scripts falsy comparisons.
     * They aren't necessary and, in fact, break logic.
     * I can't for the life of me figure out why they're there
     * and how they work in real Redis.
     * Example:
     * ```lua
     * if x ~= false then
     * ```
     * Replaced with:
     * ```lua
     * if x then
     * ```
     */
    patchMethod(this, 'defineCommand', (base) => (name, def) => {
      base(name, {
        ...def,
        lua: def.lua.replaceAll(/ ~= (false|nil) /g, ' '),
      });
    });

    // region Add limited support for bzpopmin for worker markers
    // Workers use this to wait/long-poll for new jobs.

    const getThisMarkerNotifier = () =>
      getMarkerNotifier(
        // This data object is shared between duplicate() calls.
        // This allows queues & workers to talk to each other.
        // But init() has a temporary `data` object before duplicate()
        // replaces it with the original one.
        // This is why we delay accessing it until we need it.
        (this as any).data as object,
      );

    // Add a notifier for when Bull adds to this marker set
    patchMethod(luaCommands, 'zadd', (base) => (...args) => {
      const res = base(...args);

      const key = String(args[0]);
      if (key.endsWith(':marker')) {
        const notifier = getThisMarkerNotifier();
        notifier.next(key);
      }

      return res;
    });

    // For markers, use the non-blocking zpopmin, along with the notifier to wait/"block"
    patchMethod(this, 'bzpopmin', (orig) => {
      return async (...args) => {
        const key = args[0] as any as RedisKey;
        const timeout = args.at(-1) as number;
        if (typeof key !== 'string' || !key.endsWith(':marker')) {
          return await orig(...args);
        }

        const nonBlockingPop = async () => {
          const res = await this.zpopmin(key);
          if (res.length <= 0) {
            return null;
          }
          return [key, res[0], res[1]] as [
            key: string,
            member: string,
            score: string,
          ];
        };

        return await firstValueFrom(
          rx.from(nonBlockingPop()).pipe(
            rx.concatMap((x) => (x ? [x] : EMPTY)),
            rx.concatWith(
              getThisMarkerNotifier().pipe(
                rx.filter((x) => x === key),
                rx.concatMap(() => nonBlockingPop()),
              ),
            ),
            timeout > 0 ? rx.timeout(timeout * 1000) : rx.identity,
            rx.catchError((err) => {
              if (err.name === 'TimeoutError') {
                return rx.of(null);
              }
              throw err;
            }),
          ),
        );
      };
    });
    // endregion
  };
});

/**
 * BullMQ is expecting an "end" event emitted on disconnect()
 * It waits for this event to resolve closing.
 * https://github.com/stipsan/ioredis-mock/pull/1353
 */
patchMethod(RedisMock.prototype, 'disconnect', (base) => {
  return function (this: Redis) {
    base();
    this.emit('end');
  };
});

const getMarkerNotifier = cacheable(
  new WeakMap<object, rx.Subject<string>>(),
  () => new rx.Subject(),
);

setInspectOnClass(RedisMock, (r: any) => ({
  type: 'RedisMock',
  collapsedId: r.keyData,
  include: ['keyData', 'status', 'options'],
}));

export { RedisMock };
