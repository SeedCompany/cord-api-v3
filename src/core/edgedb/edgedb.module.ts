import { Module, OnModuleDestroy } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConnectOptions, createClient } from 'edgedb';
import { IdResolver } from '~/common/validators/short-id.validator';
import type { ConfigService } from '~/core';
import { splitDb } from '../database/split-db.provider';
import { AliasIdResolver } from './alias-id-resolver';
import { codecs, registerCustomScalarCodecs } from './codecs';
import { EdgeDBTransactionalMutationsInterceptor } from './edgedb-transactional-mutations.interceptor';
import { EdgeDB } from './edgedb.service';
import { Options } from './options';
import { OptionsContext } from './options.context';
import { Client } from './reexports';
import { EdgeDBSchemaAstModule } from './schema-ast/schema-ast.module';
import { TransactionContext } from './transaction.context';

@Module({
  imports: [EdgeDBSchemaAstModule],
  providers: [
    {
      provide: Options,
      useValue: Options.defaults(),
    },
    OptionsContext,
    {
      provide: 'EDGEDB_CONNECT',
      useValue: {} satisfies ConnectOptions,
    },
    {
      provide: Client,
      inject: [OptionsContext, 'EDGEDB_CONNECT', 'CONFIG'],
      useFactory: async (
        options: OptionsContext,
        connectConfig: ConnectOptions,
        config: ConfigService,
      ) => {
        const client = createClient({
          // Only for connection retry warnings. Skip.
          logging: false,
          ...connectConfig,
        });

        options.attachToClient(client);

        if (config.databaseEngine === 'edgedb') {
          await registerCustomScalarCodecs(client, codecs);
        }

        return client;
      },
    },
    EdgeDB,
    TransactionContext,
    {
      provide: APP_INTERCEPTOR,
      useClass: EdgeDBTransactionalMutationsInterceptor,
    },
    splitDb(IdResolver, AliasIdResolver),
  ],
  exports: [EdgeDB, Client, IdResolver],
})
export class EdgeDBModule implements OnModuleDestroy {
  constructor(private readonly client: Client) {}

  async onModuleDestroy() {
    await this.client.close();
  }
}
