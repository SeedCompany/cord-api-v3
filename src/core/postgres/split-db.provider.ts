import type { Provider, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import type { PublicOf } from '../../common';
import { ConfigService } from '../config/config.service';

export const splitDb = <T>(neo: Type<T>, pg: Type<PublicOf<T>>): Provider => ({
  provide: neo,
  useFactory: (config: ConfigService, moduleRef: ModuleRef) =>
    moduleRef.create<T>(config.usePostgres ? pg : neo),
  inject: [ConfigService, ModuleRef],
});
