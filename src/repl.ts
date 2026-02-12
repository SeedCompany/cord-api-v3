import * as commonLib from '@seedcompany/common';
import { runRepl } from '@seedcompany/nest';
import * as scripture from '@seedcompany/scripture';
import { readFileSync } from 'fs';
import * as fs from 'fs/promises';
// eslint-disable-next-line no-restricted-imports
import * as lodash from 'lodash';
import { DateTime, Duration, Interval } from 'luxon';
import { basename } from 'node:path';
import { CalendarDate, DateInterval } from '~/common';
import * as common from '~/common';
import './polyfills';

runRepl({
  module: () => import('./app.module').then((m) => m.AppModule),
  options: async () => {
    const { bootstrapLogger: logger } =
      await import('~/core/logger/logger.module');
    return { logger };
  },
  import: { import: (name) => import(name) },
  extraContext: async (app) => {
    const { ResourcesHost } = await import('~/core/resources');
    const { e } = await import('~/core/gel');
    const { SessionManager } =
      await import('~/core/authentication/session/session.manager');
    const { Pnp } = await import('./components/pnp');

    const session = app.get(SessionManager).lazySessionForRootUser();
    const Resources = app.get(ResourcesHost).getEnhancedMap();

    return {
      e,
      DateTime,
      Duration,
      Interval,
      CalendarDate,
      DateInterval,
      now: DateTime.now,
      today: CalendarDate.now,
      common: { ...commonLib, ...common },
      scripture,
      ...lodash.pick(scripture, 'Book', 'Chapter', 'Verse'),
      fs,
      // eslint-disable-next-line @typescript-eslint/naming-convention
      __: lodash, // single underscore is "last execution result"
      lodash,
      session,
      sessionFor: session.withRoles,
      Resources,
      loadPnp: (filepath: string) =>
        Pnp.fromBuffer(readFileSync(filepath), basename(filepath)),
    };
  },
});
