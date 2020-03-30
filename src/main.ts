import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from './core';
import 'source-map-support/register';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  app.setGlobalPrefix(config.globalPrefix);
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      skipMissingProperties: true,
    })
  );
  app.enableShutdownHooks();
  await app.listen(config.port, () => {
    app
      .get(Logger)
      .log(
        `Listening at http://localhost:${config.port}/${config.globalPrefix}`
      );
  });
}
bootstrap().catch(err => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
