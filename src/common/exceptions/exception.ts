/**
 * The base of all of our exceptions.
 * Don't throw this, but rather a sub-class instead.
 */
export abstract class Exception extends Error {
  declare cause?: Error;

  /**
   * Basically just to group exceptions into client/server groups.
   * This may be removed later.
   */
  abstract readonly status: number;

  constructor(message: string, cause?: Error) {
    super(message, { cause });
    this.name = this.constructor.name;
  }
}

export class ServerException extends Exception {
  readonly status: number = 500;
}

export class ClientException extends Exception {
  readonly status: number = 400;
}

export function getCauseList(ex: Error, includeSelf = true): readonly Error[] {
  const previous: Error[] = includeSelf ? [ex] : [];
  let current = ex;
  while (current.cause instanceof Error) {
    current = current.cause;
    previous.push(current);
  }
  return previous;
}
