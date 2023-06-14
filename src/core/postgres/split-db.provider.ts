import type { Provider, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import type { PublicOf } from '../../common';
import { ConfigService } from '../config/config.service';

export const splitDb = <T>(
  neo4jRepository: Type<T>,
  edgeDbRepository: Type<PublicOf<T>>,
): Provider => ({
  provide: neo4jRepository,
  useFactory: (config: ConfigService, moduleRef: ModuleRef) =>
    moduleRef.create<T>(
      config.databaseEngine === 'edgedb' ? edgeDbRepository : neo4jRepository,
    ),
  inject: [ConfigService, ModuleRef],
});
