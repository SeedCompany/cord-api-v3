import { ClientException } from './exception';

/**
 * Useful in services where complex logic is needed
 * to confirm user input/request is valid.
 */
export class InputException extends ClientException {
  /**
   * @example
   * throw new InputException(
   *   `User's bio must be written in MLA format`,
   *   'user.bio'
   * );
   *
   * @param message A human (dev) readable message
   * @param field The field name in a.b.c nested notation from the Input DTO.
   * @param previous A previous error if any
   */
  constructor(message: string, readonly field?: string, previous?: Error) {
    super(message, previous);
  }
}
