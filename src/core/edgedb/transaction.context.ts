import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';
import { Client, EdgeDb } from './reexports';

@Injectable()
export class TransactionContext
  extends AsyncLocalStorage<EdgeDb>
  implements OnModuleDestroy
{
  constructor(private readonly client: Client) {
    super();
  }

  async inTx(fn: () => Promise<void>) {
    await this.client.transaction(async (tx) => {
      await this.run(tx, fn);
    });
  }

  get current() {
    return this.getStore() ?? this.client;
  }

  onModuleDestroy() {
    this.disable();
  }
}
