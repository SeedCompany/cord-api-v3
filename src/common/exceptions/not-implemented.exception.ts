import { ServerException } from './exception';

export class NotImplementedException extends ServerException {
  constructor(message?: string, previous?: Error) {
    super(message ?? 'Not implemented', previous);
  }
}
