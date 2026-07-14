import { customType } from 'drizzle-orm/pg-core';

/** An inclusive integer range `[start, end]`, as the GraphQL API exposes it. */
export interface IntRange {
  start: number;
  end: number;
}

/**
 * Postgres native `int4multirange` column, mirroring Gel's `multirange` storage
 * for `Finance::Department::IdBlock`.
 *
 * Gel/PG store ranges half-open (`[lower, upper)`); the app works in inclusive
 * `{ start, end }` like the `FinanceDepartmentIdBlock` DTO. So an inclusive
 * `{ start: 11, end: 9999 }` round-trips through the canonical literal
 * `[11,10000)`. PG always returns int ranges in canonical `[)` form, but we
 * parse the bound brackets defensively in case that ever changes.
 */
export const int4multirange = customType<{
  data: readonly IntRange[];
  driverData: string;
}>({
  dataType: () => 'int4multirange',
  toDriver: (ranges) => {
    if (ranges.length === 0) {
      // A block with no ranges can't allocate any ID. The DTO declares
      // `blocks: NonEmptyArray` and the input parser already rejects empty
      // ranges; fail fast here too so a non-DTO writer (e.g. a cutover
      // data-migration script) can't silently persist an unusable `'{}'`.
      throw new Error('int4multirange cannot serialize an empty range set');
    }
    return `{${ranges.map((r) => `[${r.start},${r.end + 1})`).join(',')}}`;
  },
  fromDriver: (value) => {
    const out: IntRange[] = [];
    for (const m of value.matchAll(/([[(])(\d+),(\d+)([\])])/g)) {
      const [, lowerBracket, lowerStr, upperStr, upperBracket] = m;
      // Normalize to inclusive [start, end].
      const start = Number(lowerStr) + (lowerBracket === '(' ? 1 : 0);
      const end = Number(upperStr) - (upperBracket === ')' ? 1 : 0);
      out.push({ start, end });
    }
    return out;
  },
});
