import type { Provider, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import type { PublicOf } from '~/common';
import { ConfigService } from '~/core/config';

type DatabaseEngines = 'gel' | 'neo4j';

export const splitDb = <T>(
  canonical: Type<T>,
  engineOverrides: Partial<Record<DatabaseEngines, Type<PublicOf<T>>>>,
) =>
  ({
    provide: canonical,
    inject: [ModuleRef, ConfigService],
    useFactory: async (moduleRef: ModuleRef, config: ConfigService) => {
      const cls =
        engineOverrides[config.databaseEngine as DatabaseEngines] ?? canonical;
      return await moduleRef.create<T>(cls);
    },
  }) satisfies Provider;
