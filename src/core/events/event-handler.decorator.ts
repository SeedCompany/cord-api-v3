import { type Type } from '@nestjs/common';
import { OnHook } from '../hooks';

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
 *
 * @deprecated use {@link OnHook} instead.
 */
export const EventsHandler =
  (...events: Array<Type | [...Type[], priority: number]>): ClassDecorator =>
  (target) => {
    for (const arg of events) {
      let priority = 0;
      let eventTypes: Type[] = [];
      if (!Array.isArray(arg)) {
        eventTypes = [arg];
      } else {
        priority = arg.pop() as number;
        eventTypes = arg as Type[];
      }

      for (const event of eventTypes) {
        OnHook(event, priority * -1)(target);
      }
    }
  };

/**
 * @deprecated IMO this adds little value. It is just a small hint
 * that "hey this class's handle() method is called indirectly".
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export interface IEventHandler<T> {
  handle: (event: T) => Promise<void>;
}
