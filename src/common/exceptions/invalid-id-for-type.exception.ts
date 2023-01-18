import { ClientException } from './exception';

/**
 * Indicate the ID from request is attached to a resource whose type is unexpected.
 */
export class InvalidIdForTypeException extends ClientException {
  constructor(message?: string, previous?: Error) {
    super(message ?? 'ID references an unexpected type', previous);
  }
}
