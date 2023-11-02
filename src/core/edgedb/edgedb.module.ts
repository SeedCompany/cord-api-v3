import { Module, OnModuleDestroy } from '@nestjs/common';
import { createClient } from 'edgedb';
import { KNOWN_TYPENAMES } from 'edgedb/dist/codecs/consts.js';
import { ScalarCodec } from 'edgedb/dist/codecs/ifaces.js';
import { Class } from 'type-fest';
import { EdgeDB } from './edgedb.service';
import { Client } from './reexports';
import { LuxonCalendarDateCodec, LuxonDateTimeCodec } from './temporal.codecs';

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
