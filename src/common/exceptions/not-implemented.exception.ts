import { ServerException } from './exception';

export class NotImplementedException extends ServerException {
  constructor(message?: string, previous?: Error) {
    super(message ?? 'Not implemented', previous);
  }

  /**
   * Used to mark that variables will be used eventually, but are not right now.
   * Helps make the linter happy.
   */
  // eslint-disable-next-line @seedcompany/no-unused-vars
  with(...unused: unknown[]) {
    return this;
  }
}
