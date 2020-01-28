import { Global, Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { CypherFactory } from './cypher.factory';
import { DatabaseService } from './database.service';

@Global()
@Module({
  imports: [
    ConfigModule,
  ],
  providers: [
    CypherFactory,
    DatabaseService,
  ],
  exports: [
    CypherFactory,
    DatabaseService,
  ],
})
export class CoreModule {}
