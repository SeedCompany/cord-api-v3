import * as commonLib from '@seedcompany/common';
import { runRepl } from '@seedcompany/nest';
import * as scripture from '@seedcompany/scripture';
import { readFileSync } from 'fs';
import * as fs from 'fs/promises';
// eslint-disable-next-line no-restricted-imports
import * as lodash from 'lodash';
import { DateTime, Duration, Interval } from 'luxon';
import { CalendarDate, DateInterval, many, maybeMany } from '~/common';
import * as common from '~/common';
import { doIt } from './doIt';
import './polyfills';

runRepl({
  module: () => import('./app.module').then((m) => m.AppModule),
  options: async () => {
    const { bootstrapLogger: logger } = await import('~/core');
    return { logger };
  },
  extraContext: async (app) => {
    const { ResourcesHost } = await import('~/core');
    const { e } = await import('~/core/edgedb');
    const { AuthenticationService } = await import(
      './components/authentication'
    );
    const { Pnp } = await import('./components/pnp');

    const session = app.get(AuthenticationService).lazySessionForRootUser();
    const Resources = app.get(ResourcesHost).getEnhancedMap();

    return {
      doIt: () => doIt(app),
      e,
      DateTime,
      Duration,
      Interval,
      CalendarDate,
      DateInterval,
      many,
      maybeMany,
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
      loadPnp: (filepath: string) => Pnp.fromBuffer(readFileSync(filepath)),
    };
  },
});
