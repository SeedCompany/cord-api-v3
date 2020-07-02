/* eslint-disable no-restricted-imports */
import { IEvent } from '@nestjs/cqrs';

export { EventsHandler } from '@nestjs/cqrs';

// eslint-disable-next-line @typescript-eslint/naming-convention
export interface IEventHandler<T extends IEvent = any> {
  handle: (event: T) => Promise<void>;
}
