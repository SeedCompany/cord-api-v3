import { Type } from '@nestjs/common';
import { nanoid } from 'nanoid';
import { ID } from '../../common';
import {
  EVENT_METADATA,
  EventHandlerMetadata,
  EVENTS_HANDLER_METADATA,
} from './constants';

export const EventsHandler =
  (...events: Type[]): ClassDecorator =>
  (target) => {
    const metadata: EventHandlerMetadata = events.map(getOrDefineEventId);
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
