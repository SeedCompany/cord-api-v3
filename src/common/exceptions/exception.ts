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

export abstract class ClientException extends Exception {
  readonly status: number = 400;
}
