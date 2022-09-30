import { HttpStatus } from '@nestjs/common';
import { lowerCase } from 'lodash';
import { Mutable } from 'type-fest';
import { InputException, InputExceptionArgs } from './input.exception';

/**
 * The requester has insufficient permission to do this operation.
 */
export class UnauthorizedException extends InputException {
  /**
   * Use default message if you don't want to be more specific
   *
   * @example
   * throw new UnauthorizedException();
   *
   * @example
   * catch (e) {
   *   throw new UnauthorizedException(e);
   * }
   *
   * @param previous A previous error if any
   */
  constructor(previous?: Error);

  /**
   * Create with a custom message
   *
   * @example
   * throw new UnauthorizedException('You cannot do that');
   *
   * @example
   * catch (e) {
   *   throw new UnauthorizedException('You cannot do that', e);
   * }
   *
   * @param message A human (dev) readable message
   * @param previous A previous error if any
   */
  constructor(message: string, previous?: Error);

  /**
   * Indicate the requester does not have permission to take an action on a
   * specific field.
   *
   * @example
   * throw new UnauthorizedException(
   *   `You cannot change the project's name`,
   *   'project.name'
   * );
   *
   * @example
   * catch (e) {
   *   throw new UnauthorizedException(
   *     `You cannot change the project's name`,
   *     'project.name',
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
    super(...InputException.parseArgs(`Insufficient permission`, args));
    (this as Mutable<this>).status = HttpStatus.FORBIDDEN;
  }

  static fromPrivileges(
    action: string,
    object: object | undefined,
    resource: string,
    edge?: string
  ) {
    action = action === 'read' ? 'view' : action;
    resource = lowerCase(resource);
    edge = edge ? lowerCase(edge) : undefined;
    const scope = object ? 'this' : 'any';
    if (action === 'create') {
      const message = edge
        ? `You do not have the permission to create ${edge} for ${scope} ${resource}`
        : `You do not have the permission to create ${resource}`;
      return new UnauthorizedException(message);
    }
    const ref = edge ? `${resource}'s ${edge}` : resource;
    return new UnauthorizedException(
      `You do not have the permission to ${action} ${scope} ${ref}`
    );
  }
}
