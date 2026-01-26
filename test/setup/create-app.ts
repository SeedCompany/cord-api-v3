import { afterAll } from '@jest/globals';
import type { ModuleMetadata, Provider } from '@nestjs/common';
import { Test, type TestingModuleBuilder } from '@nestjs/testing';
import type { DeepPartial } from 'ts-essentials';
import { andCall } from '~/common';
import { ConfigService } from '~/core';
import { HttpAdapter, type NestHttpApplication } from '~/core/http';
import { LogLevel } from '~/core/logger';
import { LevelMatcher } from '~/core/logger/level-matcher';
import { AppModule } from '../../src/app.module';
import { ephemeralGel } from './gel-setup';

export type TestApp = Pick<NestHttpApplication, 'get'>;

const appsToClose = new Set<NestHttpApplication>();
afterAll(async () => {
  for (const app of appsToClose) {
    await app.close();
  }
});

export const createApp = async ({
  config,
  imports,
  providers,
  overrides,
}: {
  config?: DeepPartial<ConfigService>;
  providers?: Provider[];
  overrides?: (builder: TestingModuleBuilder) => TestingModuleBuilder;
} & Pick<ModuleMetadata, 'imports' | 'providers'> = {}): Promise<TestApp> => {
  const db = await ephemeralGel();

  let app;
  try {
    let builder = Test.createTestingModule({
      imports: [AppModule, ...(imports ?? [])],
      providers,
    })
      .overrideProvider(LevelMatcher)
      .useValue(new LevelMatcher([], LogLevel.ERROR))
      .overrideProvider('GEL_CONNECT')
      .useValue(db?.options)
      .overrideProvider('CONFIG_PART')
      .useValue(config);
    if (overrides) {
      builder = overrides?.(builder);
    }
    const moduleFixture = await builder.compile();

    app = moduleFixture.createNestApplication<NestHttpApplication>(
      new HttpAdapter(),
    );
  } catch (e) {
    await db?.cleanup();
    throw e;
  }

  andCall(app, 'close', async () => {
    await db?.cleanup();
  });

  try {
    const config = app.get(ConfigService);
    await app.configure(app, config);

    await app.listen(0);
    const url = await app.getUrl();
    config.hostUrl$.next(new URL(url) as URL & string);
  } catch (e) {
    await app.close();
    throw e;
  }

  appsToClose.add(app);

  return app;
};
