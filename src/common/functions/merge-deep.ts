import { isPlainObject, mapValues } from '@seedcompany/common';
import type { MergeDeep } from 'type-fest';

/**
 * This merges _plain_ objects deeply, everything else is replaced.
 */
export const mergeDeep = <A extends object, B extends object>(
  a: A,
  b: B,
): MergeDeep<A, B> =>
  ({
    ...a,
    ...mapValues(b, (key, bVal) => {
      const aVal = a[key];
      return isPlainObject(aVal) && isPlainObject(bVal)
        ? mergeDeep(aVal, bVal)
        : bVal;
    }).asRecord,
  }) as any;
