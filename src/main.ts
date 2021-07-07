import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { bootstrapLogger, ConfigService } from './core';
import 'source-map-support/register';

async function bootstrap() {
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

  app.setGlobalPrefix(config.globalPrefix);

  app.enableShutdownHooks();
  await app.listen(config.port, () => {
    app
      .get(Logger)
      .log(`Listening at ${config.hostUrl}/${config.globalPrefix}`);
  });
}
bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
