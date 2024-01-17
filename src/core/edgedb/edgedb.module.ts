import { Module, OnModuleDestroy } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { createClient, Duration } from 'edgedb';
import { codecs, registerCustomScalarCodecs } from './codecs';
import { EdgeDBTransactionalMutationsInterceptor } from './edgedb-transactional-mutations.interceptor';
import { EdgeDB } from './edgedb.service';
import { Options } from './options';
import { OptionsContext } from './options.context';
import { Client } from './reexports';
import { TransactionContext } from './transaction.context';

@Module({
  providers: [
    {
      provide: 'DEFAULT_OPTIONS',
      useValue: Options.defaults().withConfig({
        // Bump from 1 min, as needed by test suite.
        // It's probably because we open & do more with in the transaction
        // than is expected by the library.
        // I'm not worried about this, and it's possible this can be removed
        // after migration if app overall is faster without Neo4j.
        // eslint-disable-next-line @typescript-eslint/naming-convention
        session_idle_transaction_timeout: Duration.from({ minutes: 5 }),
      }),
    },
    OptionsContext,
    {
      provide: Client,
      inject: [OptionsContext],
      useFactory: async (options: OptionsContext) => {
        const client = createClient({
          // Only for connection retry warnings. Skip.
          logging: false,
        });

        Object.assign(client, { options: options.current });

        await registerCustomScalarCodecs(client, codecs);

        return client;
      },
    },
    EdgeDB,
    TransactionContext,
    {
      provide: APP_INTERCEPTOR,
      useClass: EdgeDBTransactionalMutationsInterceptor,
    },
  ],
  exports: [EdgeDB, Client],
})
export class EdgeDBModule implements OnModuleDestroy {
  constructor(private readonly client: Client) {}

  async onModuleDestroy() {
    await this.client.close();
  }
}
