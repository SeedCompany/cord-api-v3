import { DiscoveryService } from '@golevelup/nestjs-discovery';
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { FnLike, groupToMapBy, mapValues, sortBy } from '@seedcompany/common';
import { stripIndent } from 'common-tags';
import { ID, ServerException } from '~/common';
import { ILogger, Logger } from '../logger';
import {
  EVENT_METADATA,
  EventHandlerMetadata,
  EVENTS_HANDLER_METADATA,
} from './constants';
import { IEventHandler } from './event-handler.decorator';

/**
 * An event bus for internal use.
 * This should be used to de-couple logic between different modules.
 */
export abstract class IEventBus {
  publish: (event: object) => Promise<void>;
  publishAll: (events: object[]) => Promise<void>;
}

@Injectable()
export class SyncEventBus implements IEventBus, OnApplicationBootstrap {
  private listenerMap: Record<ID, FnLike[]> = {};

  constructor(
    private readonly discovery: DiscoveryService,
    @Logger('event-bus') private readonly logger: ILogger,
  ) {}

  async publish(event: object): Promise<void> {
    let id;
    try {
      id = Reflect.getMetadata(EVENT_METADATA, event.constructor).id;
    } catch (e) {
      // Fails when event doesn't have an ID in its metadata,
      // which is created upon first registration with a handler.
      if (process.env.NODE_ENV === 'production') {
        return;
      }
      this.logger.warning(
        `It appears that ${event.constructor.name} does not have any registered handlers. Are you sure this is right?`,
      );
      return;
    }
    for (const handler of this.listenerMap[id] || []) {
      await handler(event);
    }
  }

  async publishAll(events: any[]): Promise<void> {
    await Promise.all(events.map((e) => this.publish(e)));
  }

  async onApplicationBootstrap() {
    const discovered =
      await this.discovery.providersWithMetaAtKey<EventHandlerMetadata>(
        EVENTS_HANDLER_METADATA,
      );

    if (process.env.NODE_ENV !== 'production') {
      const defined = new Set<string>();
      for (const entry of discovered) {
        const name = entry.discoveredClass.name;
        if (defined.has(name)) {
          throw new ServerException(stripIndent`
            Event handler "${name}" has already been defined.
            Event handlers have to have unique class names for DX sanity.
          `);
        }
        defined.add(name);
      }
    }

    const flat = discovered.flatMap((entry) => {
      const instance = entry.discoveredClass.instance as IEventHandler<any>;
      const handler = instance.handle.bind(instance);
      return [...entry.meta].map(([id, priority]) => ({
        id,
        priority,
        handler,
      }));
    });
    const grouped = groupToMapBy(flat, (entry) => entry.id);
    this.listenerMap = mapValues(grouped, (_, entries) =>
      sortBy(entries, [(entry) => entry.priority, 'desc']).map(
        (e) => e.handler,
      ),
    ).asRecord;
  }
}
