export function getCauseList(ex: Error, includeSelf = true): readonly Error[] {
  const previous: Error[] = includeSelf ? [ex] : [];
  let current = ex;
  while (current.cause instanceof Error) {
    current = current.cause;
    previous.push(current);
  }
  return previous;
}
