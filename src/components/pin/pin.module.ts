import { Module } from '@nestjs/common';
import { splitDb } from '~/core/database';
import { PinDrizzleRepository } from './pin.drizzle.repository';
import { PinRepository } from './pin.repository';
import { PinResolver } from './pin.resolver';
import { PinService } from './pin.service';

@Module({
  providers: [
    PinResolver,
    PinService,
    splitDb(PinRepository, {
      // migration-todo: drop the `as any` with the Neo4j path.
      postgres: PinDrizzleRepository as any,
    }),
  ],
  exports: [PinService],
})
export class PinModule {}
