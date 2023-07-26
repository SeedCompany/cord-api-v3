import { Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DateTime, Duration } from 'luxon';
import { Pool, PoolConfig, types } from 'pg';
import { builtins as TypeId } from 'pg-types';
import { CalendarDate } from '../../common';
import { ConfigService } from '../config/config.service';
import { ILogger, LoggerToken } from '../logger';
import { Pg } from './pg.service';

@Module({
  exports: [Pg],
  providers: [
    {
      provide: Pool,
      useFactory(config: ConfigService, logger: ILogger) {
        const pool = new Pool({
          ...(config.postgres as PoolConfig), // typecast to undo deep readonly
          log: (message, err) => {
            if (err instanceof Error) {
              logger.error(message, { exception: err });
            } else {
              logger.debug(message);
            }
          },
        });

        pool.on('connect', (client) => {
          void client
            .query('SET DATESTYLE = iso; SET intervalstyle = iso_8601')
            .then(() => logger.debug('set temporal styles'));
        });

        return pool;
      },
      inject: [ConfigService, LoggerToken('postgres:driver')],
    },
    Pg,
  ],
})
export class PostgresModule implements OnModuleInit, OnModuleDestroy {
  constructor(private readonly pool: Pool, private readonly pg: Pg) {}

  async onModuleInit() {
    const dateParser = (inner: (d: string) => any) => (val: any) => {
      if (val == null) {
        return null;
      }
      if (val === 'infinity') {
        return Infinity;
      }
      if (val === '-infinity') {
        return -Infinity;
      }
      return inner(val);
    };
    types.setTypeParser(TypeId.DATE, dateParser(CalendarDate.fromSQL));
    types.setTypeParser(TypeId.TIMESTAMP, dateParser(DateTime.fromSQL));
    types.setTypeParser(TypeId.TIMESTAMPTZ, dateParser(DateTime.fromSQL));
    types.setTypeParser(TypeId.TIMETZ, dateParser(DateTime.fromSQL));

    types.setTypeParser(TypeId.INTERVAL, (val) =>
      val == null ? val : Duration.fromISO(val),
    );
  }

  async onModuleDestroy() {
    await this.pool.end();
    // @ts-expect-error I don't want this in the public API.
    // This is easier than DI or private/public implementation/interface split.
    this.pg.clientStore.disable();
  }
}
