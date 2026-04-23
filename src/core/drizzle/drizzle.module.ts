import { Global, Module } from '@nestjs/common';
import { DrizzleService } from './drizzle.service';
import { DrizzleMigrator } from './migrator';

@Global()
@Module({
  providers: [DrizzleService, DrizzleMigrator],
  exports: [DrizzleService],
})
export class DrizzleModule {}
