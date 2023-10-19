/**
 * The base of all of our exceptions.
 * Don't throw this, but rather a sub-class instead.
 */
export abstract class Exception extends Error {
  /**
   * Basically just to group exceptions into client/server groups.
   * This may be removed later.
   */
  abstract readonly status: number;

  constructor(message: string, readonly previous?: Error) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class ServerException extends Exception {
  readonly status: number = 500;
}

export class ClientException extends Exception {
  readonly status: number = 400;
}

export const hasPrevious = (e: Error): e is Error & { previous: Error } =>
  'previous' in e && e.previous instanceof Error;

export function getPreviousList(ex: Error, includeSelf: boolean) {
  const previous: Error[] = includeSelf ? [ex] : [];
  let current = ex;
  while (hasPrevious(current)) {
    current = current.previous;
    previous.push(current);
  }
  return previous;
}
