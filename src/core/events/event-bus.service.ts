import { Injectable } from '@nestjs/common';
import { Hooks } from '../hooks';

/**
 * An event bus for internal use.
 * This should be used to de-couple logic between different modules.
 *
 * @deprecated use {@link Hooks} instead.
 */
@Injectable()
export class IEventBus {
  constructor(private readonly hooks: Hooks) {}

  async publish(event: object): Promise<void> {
    await this.hooks.run(event);
  }

  async publishAll(events: any[]): Promise<void> {
    await Promise.all(events.map((e) => this.publish(e)));
  }
}
