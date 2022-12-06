import { BootstrapConsole } from 'nestjs-console';

async function bootstrap() {
  // Ensure src files are initialized here were init errors can be caught
  const { AppModule } = await import('./app.module');

  const bootstrap = new BootstrapConsole({
    module: AppModule,
    useDecorators: true,
  });
  const app = await bootstrap.init();
  try {
    await app.init();
    await bootstrap.boot();
  } finally {
    await app.close();
  }
  process.exit();
}
void bootstrap().catch((err: any) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
