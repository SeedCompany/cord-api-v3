/**
 * This is logically very simple.
 * The usefulness is to allow this logic within an expression.
 */
export const firstOr = <T>(items: readonly T[], makeError: () => Error): T => {
  const first = items.at(0);
  if (first) {
    return first;
  }
  throw makeError();
};
