/**
 * The base of all of our exceptions.
 * Don't throw this, but rather a sub-class instead.
 */
export abstract class Exception extends Error {
  declare cause?: Error;

  constructor(message: string, cause?: Error) {
    super(message, { cause });
    this.name = this.constructor.name;
  }
}

export class ServerException extends Exception {}

export class ClientException extends Exception {}

export function getCauseList(ex: Error, includeSelf = true): readonly Error[] {
  const previous: Error[] = includeSelf ? [ex] : [];
  let current = ex;
  while (current.cause instanceof Error) {
    current = current.cause;
    previous.push(current);
  }
  return previous;
}
