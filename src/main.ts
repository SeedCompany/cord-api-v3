import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import './polyfills';

async function bootstrap() {
  // Ensure src files are initialized here were init errors can be caught
  const { AppModule } = await import('./app.module');
  const { bootstrapLogger, ConfigService } = await import('./core');

  if (process.argv.includes('--gen-schema')) {
    const app = await NestFactory.create(AppModule, { logger: false });
    await app.init();
    process.exit(0);
  }

  const app = await NestFactory.create(AppModule, {
    logger: bootstrapLogger,
  });
  const config = app.get(ConfigService);

  app.enableCors(config.cors);
  app.use(cookieParser());

  app.setGlobalPrefix(new URL(config.hostUrl).pathname.slice(1));

  config.applyTimeouts(app.getHttpServer(), config.httpTimeouts);

  app.enableShutdownHooks();
  await app.listen(config.port, () => {
    app.get(Logger).log(`Listening at ${config.hostUrl}`);
  });
}
bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
