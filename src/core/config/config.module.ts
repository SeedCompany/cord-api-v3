import { Module } from '@nestjs/common';
import { ConfigService } from './config.service';
import { EnvironmentService } from './environment.service';

@Module({
  providers: [
    ConfigService,
    EnvironmentService,
  ],
  exports: [
    ConfigService,
  ],
})
export class ConfigModule {}
