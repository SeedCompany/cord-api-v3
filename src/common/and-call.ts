import { FnLike } from '@seedcompany/common';
import { isPromise } from 'node:util/types';
import { ConditionalKeys } from 'type-fest';

export const andCall = <
  T,
  K extends ConditionalKeys<T, FnLike>,
  X extends T[K] & FnLike,
>(
  thing: T,
  methodName: K,
  add: X,
) => {
  const orig = (thing[methodName] as FnLike).bind(thing);
  (thing[methodName] as FnLike) = () => {
    const res = orig();
    return isPromise(res) ? res.then((x) => add(x)) : add(res);
  };
};
