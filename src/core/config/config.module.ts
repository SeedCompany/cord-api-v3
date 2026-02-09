import { Module } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import type { DeepPartial } from 'ts-essentials';
import { mergeDeep } from '~/common';
import { ConfigService, makeConfig } from './config.service';
import { EnvironmentService } from './environment.service';
import { VersionService } from './version.service';

@Module({
  providers: [
    {
      provide: ConfigService,
      inject: [EnvironmentService, ModuleRef],
      useFactory: (env: EnvironmentService, moduleRef: ModuleRef) => {
        const base = new (makeConfig(env))();
        const overrideList = moduleRef.get<DeepPartial<ConfigService>>(
          'CONFIG_PART',
          {
            each: true,
            strict: false,
          },
        );
        const merged = overrideList.reduce(mergeDeep, base);
        return Object.assign(new ConfigService(), merged);
      },
    },
    // placeholder so at least one provider exists in the list retrieved above
    { provide: 'CONFIG_PART', useValue: {} },
    {
      provide: 'CONFIG',
      useExisting: ConfigService,
    },
    EnvironmentService,
    VersionService,
  ],
  exports: [ConfigService, 'CONFIG', VersionService],
})
export class ConfigModule {}
