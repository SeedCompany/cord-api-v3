import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import {
  type FnLike,
  groupToMapBy,
  mapValues,
  sortBy,
} from '@seedcompany/common';
import { stripIndent } from 'common-tags';
import { type ID, ServerException } from '~/common';
import { MetadataDiscovery } from '~/core/discovery';
import { ILogger, Logger } from '../logger';
import { EVENT_METADATA } from './constants';
import { EventsHandler, type IEventHandler } from './event-handler.decorator';

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
    private readonly discovery: MetadataDiscovery,
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
    const discovered = this.discovery
      .discover(EventsHandler)
      .classes<IEventHandler<any>>();

    if (process.env.NODE_ENV !== 'production') {
      const defined = new Set<string>();
      for (const entry of discovered) {
        const name = entry.instance.constructor.name;
        if (defined.has(name)) {
          throw new ServerException(stripIndent`
            Event handler "${name}" has already been defined.
            Event handlers have to have unique class names for DX sanity.
          `);
        }
        defined.add(name);
      }
    }

    const flat = discovered.flatMap(({ instance, meta }) => {
      const handler = instance.handle.bind(instance);
      return [...meta].map(([id, priority]) => ({
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
