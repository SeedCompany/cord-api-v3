import { Module, OnModuleDestroy } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { createClient, Duration } from 'edgedb';
import { KNOWN_TYPENAMES } from 'edgedb/dist/codecs/consts.js';
import { ScalarCodec } from 'edgedb/dist/codecs/ifaces.js';
import { Class } from 'type-fest';
import { EdgeDBTransactionalMutationsInterceptor } from './edgedb-transactional-mutations.interceptor';
import { EdgeDB } from './edgedb.service';
import { Options } from './options';
import { Client } from './reexports';
import { LuxonCalendarDateCodec, LuxonDateTimeCodec } from './temporal.codecs';
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
    {
      provide: Client,
      inject: ['DEFAULT_OPTIONS'],
      useFactory: (options: Options) => {
        const client = createClient();

        Object.assign(client, { options });

        registerCustomScalarCodecs(client, [
          LuxonDateTimeCodec,
          LuxonCalendarDateCodec,
        ]);

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

const registerCustomScalarCodecs = (
  client: Client,
  scalars: ReadonlyArray<Class<ScalarCodec> & { edgedbTypeName: string }>,
) => {
  const map: Map<string, ScalarCodec> = (client as any).pool._codecsRegistry
    .customScalarCodecs;
  for (const scalar of scalars) {
    const uuid = KNOWN_TYPENAMES.get(scalar.edgedbTypeName)!;
    map.set(uuid, new scalar(uuid));
  }
};
