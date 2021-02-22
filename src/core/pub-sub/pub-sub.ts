import { Injectable, Type } from '@nestjs/common';
import { PubSubEngine } from 'graphql-subscriptions';
import { from } from 'ix/asynciterable';
import type { AsyncIterableX } from 'ix/asynciterable/asynciterablex';
import { many, ServerException } from '../../common';
import type { Many } from '../../common';

@Injectable()
export class PubSub {
  constructor(private readonly inner: PubSubEngine) {}

  async publish<T>(triggerName: Type<T> | string, payload: T): Promise<void>;
  async publish<T>(payload: T): Promise<void>;
  async publish<T>(
    payloadOrName: string | Type<T>,
    payloadObj?: T
  ): Promise<void> {
    let name: string;
    let payload: T;
    if (typeof payloadOrName === 'string') {
      name = payloadOrName;
      payload = payloadObj!;
    } else if (typeof payloadOrName === 'function') {
      name = payloadOrName.name;
      payload = payloadObj!;
      if (name === '') {
        throw new ServerException(
          'When giving a type as the trigger name, the type name must not be anonymous'
        );
      }
    } else {
      name = Object.getPrototypeOf(payloadOrName).constructor.name;
      if (name === 'Object') {
        throw new ServerException(
          'When giving an object as the triggerName and payload, the object must be an instance of a class'
        );
      }
      payload = payloadOrName;
    }

    await this.inner.publish(name, payload);
  }

  listen<T>(triggers: Many<Type<T> | string>): AsyncIterableX<T> {
    return from(
      this.inner.asyncIterator(
        many(triggers).map((t) => (typeof t === 'string' ? t : t.name))
      )
    );
  }
}
