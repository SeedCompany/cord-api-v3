import * as commonLib from '@seedcompany/common';
import { runRepl } from '@seedcompany/nest';
import { EmailService } from '@seedcompany/nestjs-email';
import { Book } from '@seedcompany/scripture';
import * as scripture from '@seedcompany/scripture';
import { readFileSync } from 'fs';
import * as fs from 'fs/promises';
// eslint-disable-next-line no-restricted-imports
import * as lodash from 'lodash';
import { DateTime, Duration, Interval } from 'luxon';
import { type DeepPartial } from 'ts-essentials';
import { CalendarDate, DateInterval, type ID } from '~/common';
import * as common from '~/common';
import './polyfills';
import {
  GoalCompleted,
  type GoalCompletedProps,
} from '~/core/email/templates/product-consultant-checked.template';

runRepl({
  module: () => import('./app.module').then((m) => m.AppModule),
  options: async () => {
    const { bootstrapLogger: logger } = await import('~/core');
    return { logger };
  },
  extraContext: async (app) => {
    const { ResourcesHost } = await import('~/core');
    const { e } = await import('~/core/gel');
    const { AuthenticationService } = await import(
      './components/authentication'
    );
    const { Pnp } = await import('./components/pnp');

    const session = app.get(AuthenticationService).lazySessionForRootUser();
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
      loadPnp: (filepath: string) => Pnp.fromBuffer(readFileSync(filepath)),
      doIt: async () => {
        await app.get(EmailService).send('', GoalCompleted, {
          engagement: { id: 'eng' as ID },
          project: { id: 'proj' as ID, name: { value: 'English 1' } },
          language: {
            id: 'eng' as ID,
            name: { value: 'English' },
            ethnologue: {
              code: { value: 'eng' },
            },
          },
          recipient: {},
          completedBooks: [
            Book.named('Matthew').full,
            Book.named('Luke').full,
            Book.named('Acts').full,
          ],
        } satisfies DeepPartial<GoalCompletedProps> as any);
      },
    };
  },
});
