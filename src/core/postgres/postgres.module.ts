import { Module } from '@nestjs/common';
import { ConfigModule } from '../config/config.module';
import { PostgresService } from './postgres.service';

@Module({
  imports: [ConfigModule],
  providers: [PostgresService],
  exports: [PostgresService],
})
export class PostgresModule {}
