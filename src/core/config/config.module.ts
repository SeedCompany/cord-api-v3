import { Global, Module } from '@nestjs/common';
import { ConfigService } from './config.service';
import { EnvironmentService } from './environment.service';

@Global()
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
