import { Type } from '@nestjs/common';
import { nanoid } from 'nanoid';
import { ID } from '../../common';
import {
  EVENT_METADATA,
  EventHandlerMetadata,
  EVENTS_HANDLER_METADATA,
  Priority,
} from './constants';

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
export const EventsHandler =
  (...events: Array<Type | [...Type[], Priority]>): ClassDecorator =>
  (target) => {
    const metadata: EventHandlerMetadata = new Map<ID, Priority>();

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

    Reflect.defineMetadata(EVENTS_HANDLER_METADATA, metadata, target);
  };

// eslint-disable-next-line @typescript-eslint/naming-convention
export interface IEventHandler<T> {
  handle: (event: T) => Promise<void>;
}

const getOrDefineEventId = (event: Type): ID => {
  if (!Reflect.hasMetadata(EVENT_METADATA, event)) {
    const id = nanoid() as ID;
    Reflect.defineMetadata(EVENT_METADATA, { id }, event);
    return id;
  }
  return Reflect.getMetadata(EVENT_METADATA, event).id;
};
