import type { Provider, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import type { PublicOf } from '~/common';
import { ConfigService } from '../config/config.service';

export const splitDb = <T>(
  neo4jRepository: Type<T>,
  edgeDbRepository: Type<PublicOf<T>>,
) =>
  ({
    provide: neo4jRepository,
    inject: [ModuleRef, ConfigService],
    useFactory: async (moduleRef: ModuleRef, config: ConfigService) => {
      const cls =
        config.databaseEngine === 'edgedb' ? edgeDbRepository : neo4jRepository;
      return await moduleRef.create<T>(cls);
    },
  } satisfies Provider);

export const splitDb2 = <T>(
  token: Type<T>,
  repos: { edge: Type<PublicOf<T>>; neo4j: Type<PublicOf<T>> },
) =>
  ({
    provide: token,
    inject: [ModuleRef, ConfigService],
    useFactory: async (moduleRef: ModuleRef, config: ConfigService) => {
      const cls = config.databaseEngine === 'edgedb' ? repos.edge : repos.neo4j;
      return await moduleRef.create<T>(cls);
    },
  } satisfies Provider);
