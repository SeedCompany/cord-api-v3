import * as commonLib from '@seedcompany/common';
import { runRepl } from '@seedcompany/nest';
import * as fs from 'fs';
// eslint-disable-next-line no-restricted-imports
import * as lodash from 'lodash';
import { DateTime, Duration, Interval } from 'luxon';
import { CalendarDate, DateInterval, many, maybeMany } from '~/common';
import * as common from '~/common';
import './polyfills';

runRepl({
  module: () => import('./app.module').then((m) => m.AppModule),
  options: async () => {
    const { bootstrapLogger: logger } = await import('~/core');
    return { logger };
  },
  extraContext: async (app) => {
    const { ResourcesHost } = await import('~/core');
    const { AuthenticationService } = await import(
      './components/authentication'
    );
    const { Pnp } = await import('./components/pnp');

    const session = app
      .get(AuthenticationService)
      .lazySessionForRootAdminUser();
    const Resources = await app.get(ResourcesHost).getEnhancedMap();

    return {
      DateTime,
      Duration,
      Interval,
      CalendarDate,
      DateInterval,
      many,
      maybeMany,
      common: { ...commonLib, ...common },
      // eslint-disable-next-line @typescript-eslint/naming-convention
      __: lodash, // single underscore is "last execution result"
      lodash,
      session,
      sessionFor: session.withRoles,
      Resources,
      loadPnp: (filepath: string) => Pnp.fromBuffer(fs.readFileSync(filepath)),
    };
  },
});
