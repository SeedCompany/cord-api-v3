import { clc } from '@nestjs/common/utils/cli-colors.util';
import { NestFactory } from '@nestjs/core';
import { assignToObject } from '@nestjs/core/repl/assign-to-object.util';
import { ReplContext } from '@nestjs/core/repl/repl-context';
// eslint-disable-next-line no-restricted-imports
import * as lodash from 'lodash';
import { DateTime, Duration, Interval } from 'luxon';
import {
  CalendarDate,
  DateInterval,
  many,
  mapFromList,
  maybeMany,
} from '~/common';
import { bootstrapLogger } from '~/core';
import { AppModule } from './app.module';
import 'source-map-support/register';

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

  const replContext = new ReplContext(app);
  const _repl = await Promise.resolve().then(() => import('repl'));
  const replServer = _repl.start({
    prompt: clc.green('> '),
    ignoreUndefined: true,
  });
  assignToObject(replServer.context, replContext.globalScope);

  // Our own stuff below

  assignToObject(replServer.context, {
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
  });
}
bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
