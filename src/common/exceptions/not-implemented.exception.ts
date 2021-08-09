import { ServerException } from './exception';

export class NotImplementedException extends ServerException {
  constructor(message?: string, previous?: Error) {
    super(message ?? 'Not implemented', previous);
  }

  // Easy way to mark variables as used for eslint until implemented
  // eslint-disable-next-line @seedcompany/no-unused-vars
  with(...unused: any[]) {
    return this;
  }
}
