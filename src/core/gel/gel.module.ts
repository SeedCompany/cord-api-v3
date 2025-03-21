import { Module, OnModuleDestroy } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConnectOptions, createClient, Options } from 'gel';
import { IdResolver } from '~/common/validators/short-id.validator';
import type { ConfigService } from '~/core';
import { splitDb } from '../database/split-db.provider';
import { AliasIdResolver } from './alias-id-resolver';
import { codecs, registerCustomScalarCodecs } from './codecs';
import { GelWarningHandler } from './errors/warning.handler';
import { GelTransactionalMutationsInterceptor } from './gel-transactional-mutations.interceptor';
import { Gel } from './gel.service';
import { OptionsContext } from './options.context';
import { Client } from './reexports';
import { GelSchemaAstModule } from './schema-ast/schema-ast.module';
import { TransactionContext } from './transaction.context';

import './errors';

@Module({
  imports: [GelSchemaAstModule],
  providers: [
    {
      provide: Options,
      inject: [GelWarningHandler],
      useFactory: (warningHandler: GelWarningHandler) =>
        Options.defaults().withWarningHandler(
          warningHandler.handle.bind(warningHandler),
        ),
    },
    OptionsContext,
    {
      provide: 'GEL_CONNECT',
      useValue: {} satisfies ConnectOptions,
    },
    {
      provide: Client,
      inject: [OptionsContext, 'GEL_CONNECT', 'CONFIG'],
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

        if (config.databaseEngine === 'gel') {
          await registerCustomScalarCodecs(client, codecs);
        }

        return client;
      },
    },
    Gel,
    TransactionContext,
    {
      provide: APP_INTERCEPTOR,
      useClass: GelTransactionalMutationsInterceptor,
    },
    splitDb(IdResolver, AliasIdResolver),
    GelWarningHandler,
  ],
  exports: [Gel, Client, IdResolver],
})
export class GelModule implements OnModuleDestroy {
  constructor(private readonly client: Client) {}

  async onModuleDestroy() {
    await this.client.close();
  }
}
