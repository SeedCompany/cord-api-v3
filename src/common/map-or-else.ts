/**
 * This allows "partitioning" and mapping at the same type.
 *
 * This is similar to lodash's partition.
 * It uses a boolean return from the predicate function to determine which
 * array to put the item in.
 * Where this accepts a new value directly which is put in the first array
 * or the ELSE sigil, which puts the item in the second.
 * This is only slightly more verbose:
 * ```diff
 * - return condition
 * + return condition ? value : ELSE
 * ```
 * This avoids having to duplicate logic to see if the item can be converted
 * and then convert the ones that can while keeping track of the ones that cant.
 *
 * Using this function allows the types of these two lists to be inferred,
 * so the call site doesn't have to duplicate that work.
 *
 * @example Partitioning only
 * declare const numbers: number[];
 * const [positive, negative] = mapWithElse(numbers, (num, { ELSE }) =>
 *   return num >= 0 ? num : ELSE
 * );
 *
 * @example Partitioning & mapping
 * declare const commands: strings[];
 * const [matched, badInput] = mapWithElse(commands, (command, { ELSE }) => {
 *   const match = parseCommand(command); // { program: string; args: string[] } | null
 *   return match ?? ELSE;
 * });
 * badInput.forEach(command => console.log('Bad input: ', command);
 * matched.forEach(({ program, args }) => execute(program, args));
 */
export const mapOrElse = <T, R>(
  input: Iterable<T>,
  mapper: (item: T, context: typeof ctx) => R | typeof ELSE,
): readonly [mapped: readonly R[], remaining: readonly T[]] => {
  const mapped: R[] = [];
  const remaining: T[] = [];
  for (const item of input) {
    const result = mapper(item, ctx);
    if (result !== ELSE) {
      mapped.push(result);
    } else {
      remaining.push(item);
    }
  }
  return [mapped, remaining];
};
const ELSE = Symbol('ELSE');
const ctx = { ELSE } as const;

mapOrElse.ELSE = ELSE;
