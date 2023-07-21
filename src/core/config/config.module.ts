import { Module } from '@nestjs/common';
import { ConfigService, makeConfig } from './config.service';
import { EnvironmentService } from './environment.service';
import { VersionService } from './version.service';

@Module({
  providers: [
    {
      provide: ConfigService,
      inject: [EnvironmentService],
      useFactory: (env: EnvironmentService) =>
        Object.assign(new ConfigService(), new (makeConfig(env))()),
    },
    EnvironmentService,
    VersionService,
  ],
  exports: [ConfigService, VersionService],
})
export class ConfigModule {}
