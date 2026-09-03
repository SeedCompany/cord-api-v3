import { ServiceUnavailableException } from './service-unavailable.exception';

/**
 * A write was attempted while the API is in read-only maintenance mode.
 * @see ReadOnlyModePlugin in ~/core/graphql for what enforces this.
 */
export class ReadOnlyModeException extends ServiceUnavailableException {
  constructor(message?: string, previous?: Error) {
    super(
      message ??
        'CORD is temporarily read-only while maintenance is underway. ' +
          'Viewing data still works, but changes cannot be saved right now. ' +
          'Please try again later.',
      previous,
    );
  }
}
