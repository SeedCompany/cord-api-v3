import { Module, OnModuleDestroy } from '@nestjs/common';
import { createClient, Executor } from 'edgedb';
import { Client, EdgeDb } from './reexports';
import {
  customScalarCodecsMapFromClient,
  LuxonCalendarDateCodec,
  LuxonDateTimeCodec,
} from './temporal.codecs';
import { TransactionContext } from './transaction.context';

@Module({
  providers: [
    {
      provide: Client,
      useFactory: () => {
        const client = createClient();

        const codecs = customScalarCodecsMapFromClient(client);
        LuxonDateTimeCodec.registerTo(codecs);
        LuxonCalendarDateCodec.registerTo(codecs);

        return client;
      },
    },
    {
      provide: EdgeDb,
      inject: [TransactionContext],
      useFactory: async (txCtx: TransactionContext) => {
        // basically a lazy Transaction/Executor/"EdgeDb" that points to the
        // current transaction in context or just the client if there is no transaction.
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        return new Proxy({} as Executor, {
          get(target: Executor, p: string, receiver: unknown) {
            return Reflect.get(txCtx.current, p, receiver);
          },
        });
      },
    },
    TransactionContext,
  ],
  exports: [EdgeDb, TransactionContext, Client],
})
export class EdgedbModule implements OnModuleDestroy {
  constructor(private readonly client: Client) {}

  async onModuleDestroy() {
    await this.client.close();
  }
}
