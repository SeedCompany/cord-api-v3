import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { DrizzleTransactionalMutationsInterceptor } from './drizzle-transactional-mutations.interceptor';
import { DrizzleService } from './drizzle.service';
import { DrizzleMigrator } from './migrator';
import { PgEtlService } from './refresh/pg-etl.service';
import { PgRefreshCommand } from './refresh/pg-refresh.command';

@Global()
@Module({
  providers: [
    DrizzleService,
    DrizzleMigrator,
    PgEtlService,
    PgRefreshCommand,
    {
      provide: APP_INTERCEPTOR,
      useClass: DrizzleTransactionalMutationsInterceptor,
    },
  ],
  exports: [DrizzleService],
})
export class DrizzleModule {}
