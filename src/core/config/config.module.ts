import { Module } from '@nestjs/common';
import { ConfigService } from './config.service';
import { EnvironmentService } from './environment.service';
import { VersionService } from './version.service';

@Module({
  providers: [ConfigService, EnvironmentService, VersionService],
  exports: [ConfigService, VersionService],
})
export class ConfigModule {}
