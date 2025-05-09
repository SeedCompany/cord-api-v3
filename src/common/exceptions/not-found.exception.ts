import { InputException, type InputExceptionArgs } from './input.exception';

/**
 * Something asked for or referenced has cannot be found.
 */
export class NotFoundException extends InputException {
  /**
   * Use default message if you don't want to be more specific
   *
   * @example
   * throw new NotFoundException();
   *
   * @example
   * catch (e) {
   *   throw new NotFoundException(e);
   * }
   *
   * @param previous A previous error if any
   */
  constructor(previous?: Error);

  /**
   * Create with a custom message
   *
   * @example
   * throw new NotFoundException('Could not find that project');
   *
   * @example
   * catch (e) {
   *   throw new NotFoundException('Could not find that project', e);
   * }
   *
   * @param message A human (dev) readable message
   * @param previous A previous error if any
   */
  constructor(message: string, previous?: Error);

  /**
   * Indicate that a field given, like an ID in a mutation, cannot be found.
   *
   * @example
   * throw new NotFoundException(
   *   `Cannot create language engagement because that language could not be found`,
   *   'engagement.languageId'
   * );
   *
   * @example
   * catch (e) {
   *   throw new NotFoundException(
   *     `Cannot create language engagement because that language could not be found`,
   *     'engagement.languageId',
   *     e
   *   );
   * }
   *
   * @param message A human (dev) readable message
   * @param field The field name in a.b.c nested notation from the Input DTO.
   * @param previous A previous error if any
   */
  constructor(message: string, field: string, previous?: Error);

  constructor(...args: InputExceptionArgs) {
    super(...InputException.parseArgs(`Not Found`, args));
  }
}
