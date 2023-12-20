import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';
import { Executor } from 'edgedb';
import { Client } from './reexports';

@Injectable()
export class TransactionContext
  extends AsyncLocalStorage<Executor>
  implements OnModuleDestroy
{
  constructor(private readonly client: Client) {
    super();
  }

  async inTx<R>(fn: () => Promise<R>): Promise<R> {
    return await this.client.transaction(async (tx) => {
      return await this.run(tx, fn);
    });
  }

  get current() {
    return this.getStore() ?? this.client;
  }

  onModuleDestroy() {
    this.disable();
  }
}
