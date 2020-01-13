import { DateTime } from 'luxon';

export interface Unavailability {
  readonly id: string;
  description: string;
  start: DateTime;
  end: DateTime;
}
