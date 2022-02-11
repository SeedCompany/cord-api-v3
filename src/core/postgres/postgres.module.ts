import { Module, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
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
          ...config.postgres,
          log: (message, err) => {
            if (err instanceof Error) {
              logger.error(message, { exception: err });
            } else {
              logger.debug(message);
            }
          },
        });

        return pool;
      },
      inject: [ConfigService, LoggerToken('postgres:driver')],
    },
    Pg,
  ],
})
export class PostgresModule implements OnModuleDestroy {
  constructor(private readonly pool: Pool) {}

  async onModuleDestroy() {
    await this.pool.end();
  }
}
