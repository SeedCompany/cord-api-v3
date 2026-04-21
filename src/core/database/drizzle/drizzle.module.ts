import { Global, Module } from '@nestjs/common';
import { DrizzleService } from './drizzle.service.js';
import { DrizzleMigrator } from './migrator.js';

@Global()
@Module({
  providers: [DrizzleService, DrizzleMigrator],
  exports: [DrizzleService],
})
export class DrizzleModule {}
