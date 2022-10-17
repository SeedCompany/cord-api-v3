import { clc } from '@nestjs/common/utils/cli-colors.util';
import { NestFactory } from '@nestjs/core';
import { assignToObject } from '@nestjs/core/repl/assign-to-object.util';
import { ReplContext } from '@nestjs/core/repl/repl-context';
import { mkdir } from 'fs/promises';
// eslint-disable-next-line no-restricted-imports
import * as lodash from 'lodash';
import { DateTime, Duration, Interval } from 'luxon';
import { promisify } from 'util';
import { createContext, runInContext } from 'vm';
import {
  bufferFromStream,
  CalendarDate,
  DateInterval,
  many,
  mapFromList,
  maybeMany,
  Session,
} from '~/common';
import { bootstrapLogger, ConfigService, ResourcesHost } from '~/core';
import { AppModule } from './app.module';
import { AuthenticationService } from './components/authentication';
import 'source-map-support/register';
import { Role } from './components/authorization';

/**
 * This does the same thing as {@link import('@nestjs/core').repl}
 * Just that we use our own logger & add more to the global context
 */
async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    abortOnError: false,
    logger: bootstrapLogger,
  });
  await app.init();

  const session = await app
    .get(AuthenticationService)
    .sessionForUser(app.get(ConfigService).rootAdmin.id);
  const Resources = await app.get(ResourcesHost).getEnhancedMap();

  const context = assignToObject(new ReplContext(app).globalScope, {
    DateTime,
    Duration,
    Interval,
    CalendarDate,
    DateInterval,
    mapFromList,
    many,
    maybeMany,
    // eslint-disable-next-line @typescript-eslint/naming-convention
    __: lodash, // single underscore is "last execution result"
    lodash,
    session,
    sessionFor: (role: Role): Session => ({
      ...session,
      roles: [`global:${role}`],
    }),
    Resources,
  });

  if (!process.stdin.isTTY) {
    const input = await bufferFromStream(process.stdin);
    runInContext(input.toString(), createContext(context));
    await app.close();
    return;
  }

  const _repl = await Promise.resolve().then(() => import('repl'));
  const replServer = _repl.start({
    prompt: clc.green('> '),
    ignoreUndefined: true,
  });
  replServer.on('exit', () => void app.close());

  assignToObject(replServer.context, context);

  await mkdir('.cache', { recursive: true });
  await promisify(replServer.setupHistory.bind(replServer))(
    '.cache/repl_history'
  );
}
bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
