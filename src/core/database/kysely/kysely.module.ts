import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '~/core/config/config.module';
import { KyselyService } from './kysely.service';
import { KyselyMigrator } from './migrator';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [KyselyService, KyselyMigrator],
  exports: [KyselyService, KyselyMigrator],
})
export class KyselyModule {}
