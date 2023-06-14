import { Module, OnModuleDestroy } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { createClient } from 'edgedb';
import { KNOWN_TYPENAMES } from 'edgedb/dist/codecs/consts.js';
import { ScalarCodec } from 'edgedb/dist/codecs/ifaces.js';
import { Class } from 'type-fest';
import { EdgeDBTransactionalMutationsInterceptor } from './edgedb-transactional-mutations.interceptor';
import { EdgeDB } from './edgedb.service';
import { Client } from './reexports';
import { LuxonCalendarDateCodec, LuxonDateTimeCodec } from './temporal.codecs';
import { TransactionContext } from './transaction.context';

@Module({
  providers: [
    {
      provide: Client,
      useFactory: () => {
        const client = createClient();

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
