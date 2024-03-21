import { NestFactory } from '@nestjs/core';
import { Builtins, runExit } from 'clipanion';
import './polyfills';
import { CommandDiscovery } from '~/core/cli/command.discovery';

async function bootstrap() {
  // Ensure src files are initialized here were init errors can be caught
  const { AppModule } = await import('./app.module');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });
  try {
    await app.init();

    const commands = await app.get(CommandDiscovery).discover();
    await runExit({ binaryLabel: 'CORD', binaryName: `yarn console` }, [
      ...commands,
      Builtins.HelpCommand as any,
    ]);
  } finally {
    await app.close();
  }
}
void bootstrap().catch((err: any) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
