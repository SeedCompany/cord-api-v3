import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import 'source-map-support/register';
import { ConfigService } from './core';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  });
  const config = app.get(ConfigService);
  app.setGlobalPrefix(config.globalPrefix);
  await app.listen(config.port, () => {
    console.log(
      `Listening at http://localhost:${config.port}/${config.globalPrefix}`,
    );
  });
}
bootstrap().catch(err => {
  console.error(err);
  process.exit(1);
});
