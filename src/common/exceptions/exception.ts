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
