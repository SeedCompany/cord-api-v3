import { ID } from '../../common';

export const EVENT_METADATA = '__event__';
export const EVENTS_HANDLER_METADATA = '__eventsHandler__';

export type EventHandlerMetadata = Map<ID, Priority>;

/**
 * Higher goes first.
 */
export type Priority = number;
