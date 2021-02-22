import { Injectable } from '@nestjs/common';
import { PubSubEngine } from 'graphql-subscriptions';
import { from } from 'ix/asynciterable';
import type { AsyncIterableX } from 'ix/asynciterable/asynciterablex';
import type { Many } from '../../common';

@Injectable()
export class PubSub {
  constructor(private readonly inner: PubSubEngine) {}

  async publish(triggerName: string, payload: any): Promise<void> {
    await this.inner.publish(triggerName, payload);
  }

  listen<T>(triggers: Many<string>): AsyncIterableX<T> {
    return from(this.inner.asyncIterator<T>(triggers as string[]));
  }
}
