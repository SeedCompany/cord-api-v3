import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestHttpApplication } from '~/core/http';
import './polyfills';

async function bootstrap() {
  // Ensure src files are initialized here were init errors can be caught
  const { AppModule } = await import('./app.module');
  const { bootstrapLogger, ConfigService } = await import('./core');
  const { HttpAdapter } = await import('./core/http');

  if (process.argv.includes('--gen-schema')) {
    const app = await NestFactory.create<NestHttpApplication>(
      AppModule,
      new HttpAdapter(),
      {
        logger: false,
      },
    );
    await app.init();
    process.exit(0);
  }

  const app = await NestFactory.create<NestHttpApplication>(
    AppModule,
    new HttpAdapter(),
    {
      logger: bootstrapLogger,
    },
  );
  const config = app.get(ConfigService);

  await app.configure(app, config);

  app.enableShutdownHooks();
  await app.listen(config.port, '0.0.0.0', () => {
    app.get(Logger).log(`Listening at ${config.hostUrl$.value}graphql`);
  });
}
bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
