import { UnauthenticatedException } from '~/common';

/**
 * No session established for the user
 */

export class NoSessionException extends UnauthenticatedException {
  description: string | undefined;

  constructor(message?: string, description?: string, previous?: Error) {
    super(message ?? `No session`, previous);
    this.description = description;
  }
}
