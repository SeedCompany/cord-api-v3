import { type Type } from '@nestjs/common';
import { createMetadataDecorator } from '@seedcompany/nest';
import { nanoid } from 'nanoid';
import { type ID } from '~/common';
import { EVENT_METADATA, type Priority } from './constants';

/**
 * Subscribe to these given events.
 * Optionally you can declare the listener's priority or each or several events.
 * Higher priority numbers go first.
 *
 * @example
 * ```ts
 * @EventsHandler(Event)
 * @EventsHandler(Event, Event2)
 * @EventsHandler([Event, 10])
 * @EventsHandler([Event, Event2, 10])
 * @EventsHandler(
 *   [Event, 10],
 *   Event2
 * )
 * ```
 */
export const EventsHandler = createMetadataDecorator({
  types: ['class'],
  setter: (...events: Array<Type | [...Type[], Priority]>) => {
    const metadata = new Map<ID, Priority>();

    for (const arg of events) {
      let priority: Priority = 0;
      let eventTypes: Type[] = [];
      if (!Array.isArray(arg)) {
        eventTypes = [arg];
      } else {
        priority = arg.pop() as Priority;
        eventTypes = arg as Type[];
      }

      for (const event of eventTypes) {
        metadata.set(getOrDefineEventId(event), priority);
      }
    }

    return metadata;
  },
});

// eslint-disable-next-line @typescript-eslint/naming-convention
export interface IEventHandler<T> {
  handle: (event: T) => Promise<void>;
}

const getOrDefineEventId = (event: Type): ID => {
  if (!Reflect.hasMetadata(EVENT_METADATA, event)) {
    const id: ID = nanoid();
    Reflect.defineMetadata(EVENT_METADATA, { id }, event);
    return id;
  }
  return Reflect.getMetadata(EVENT_METADATA, event).id;
};
