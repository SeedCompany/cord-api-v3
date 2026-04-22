import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { DrizzleTransactionalMutationsInterceptor } from './drizzle-transactional-mutations.interceptor';
import { DrizzleService } from './drizzle.service';
import { DrizzleMigrator } from './migrator';

@Global()
@Module({
  providers: [
    DrizzleService,
    DrizzleMigrator,
    {
      provide: APP_INTERCEPTOR,
      useClass: DrizzleTransactionalMutationsInterceptor,
    },
  ],
  exports: [DrizzleService],
})
export class DrizzleModule {}
