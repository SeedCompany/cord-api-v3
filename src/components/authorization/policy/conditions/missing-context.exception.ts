import { ServerException } from '~/common';

export class MissingContextException extends ServerException {
  constructor(message?: string, cause?: Error) {
    super(message ?? "Needed context object but wasn't given", cause);
  }
}
