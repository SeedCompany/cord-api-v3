import { type Logger } from '@nestjs/common';
import { type FnLike, type Nil, patchMethod } from '@seedcompany/common';
// @ts-expect-error no types are defined
import Fengari from 'fengari';
// @ts-expect-error no types are defined
import FengariInterp from 'fengari-interop';
import type Redis from 'ioredis';
import { Packr } from 'msgpackr';

const packer = new Packr({ useRecords: false });

export const setLuaInit = (
  client: Redis,
  logger: Logger | Nil,
  define: (lua: Lua) => void,
) => {
  const vmInit = (vm: any) => define(betterVm(vm, logger ?? undefined));
  Object.defineProperty(client, 'vmInit', { value: vmInit, enumerable: false });
};

export const defineMsgPackModule = (lua: Lua) => {
  // Define cmsgpack.unpack
  lua.defineFunction('cmsgpack_unpack', (buffer: Buffer) => {
    let result = packer.unpack(buffer);
    lua.logger?.debug('cmsgpack.unpack', result);
    result = deepNullToUndefined(result);
    return result;
  });
  lua.defineGlobalObject('cmsgpack', {
    unpack: 'cmsgpack_unpack',
  });
};

export const defineJsonModule = (lua: Lua) => {
  lua.defineFunction('cjson_encode', (input: unknown) => {
    try {
      const res = JSON.stringify(input);
      lua.logger?.debug('cjson.encode', res, '<=', input);
      return res;
    } catch (e) {
      lua.logger?.error(
        'cjson.encode',
        String(input),
        '=>',
        'Invalid JSON input',
      );
      throw e;
    }
  });
  lua.defineFunction('cjson_decode', (input: string) => {
    try {
      const res = JSON.parse(input);
      lua.logger?.debug('cjson.decode', input, '=>', res);
      return res;
    } catch (e) {
      lua.logger?.error(
        'cjson.decode',
        String(input),
        '=>',
        'Invalid JSON input',
      );
      throw e;
    }
  });
  lua.defineGlobalObject('cjson', {
    encode: 'cjson_encode',
    decode: 'cjson_decode',
  });
};

/**
 * convert null to undefined, which Lua interprets as nil,
 * rather than a JS null.
 */
export const deepNullToUndefined = (obj: unknown): unknown => {
  if (obj == null) {
    return undefined;
  }
  if (Array.isArray(obj)) {
    return obj.map(deepNullToUndefined);
  }
  if (typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, deepNullToUndefined(v)]),
    );
  }
  return obj;
};

type Lua = ReturnType<typeof betterVm>;
const betterVm = (vm: any, logger?: Logger) => {
  const setGlobal = (name: string) => {
    Fengari.lua.lua_setglobal(vm.L, Fengari.to_luastring(name));
  };
  const defineFunction = function (name: string, fn: FnLike) {
    const wrappedFn = () => {
      const args = vm.extractArgs();

      const result = fn(...args);

      // lua array indexes are 1-based, so convert to handle
      if (Array.isArray(result)) {
        result.unshift(null);
        Object.defineProperty(result, Symbol.for('__len'), {
          value: () => result.length - 1,
        });
      }

      // push the result back to lua stack as js value
      FengariInterp.push(vm.L, result);
      // Return the number of items we've pushed,
      // lua will pick this many items from the stack as return values
      return 1;
    };
    Fengari.lua.lua_pushjsfunction(vm.L, wrappedFn);
    setGlobal(name);
  };
  const defineGlobalObject = (
    name: string,
    entries: Record<string, string>,
  ) => {
    vm.luaExecString(`
      local ${name} = {
        ${Object.entries(entries)
          .map(([k, v]) => `${k} = ${v}`)
          .join(',\n')}
      }
      return ${name}
    `);
    setGlobal(name);
  };
  return {
    logger,
    defineFunction,
    defineGlobalObject,
    setGlobal,
    exec: vm.luaExecString,
  };
};

/**
 * Lua has integers and floats.
 * fengari-interop converts JS numbers to floats.
 * This causes problems with string concatenation, as Lua uses the float representation.
 * e.g. "foo:1.0" instead of "foo:1"
 * We fix this behavior to check if the number is an integer
 * and convert to that Lua type instead.
 * Both JS & Lua are loose with these two types and can convert/compare between
 * them seamlessly.
 * It is beyond me why this is not the default behavior.
 * https://github.com/fengari-lua/fengari-interop/issues/31
 */
patchMethod(FengariInterp, 'push', (base) => {
  return (state: unknown, value: unknown) => {
    if (typeof value === 'number' && Number.isSafeInteger(value)) {
      Fengari.lua.lua_pushinteger(state, value);
      return;
    }
    base(state, value);
  };
});
