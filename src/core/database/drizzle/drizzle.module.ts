import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '~/core/config/config.module';
import { DrizzleService } from './drizzle.service';
import { DrizzleMigrator } from './migrator';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [DrizzleService, DrizzleMigrator],
  exports: [DrizzleService],
})
export class DrizzleModule {}
