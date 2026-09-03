import { Module } from '@nestjs/common';
import { splitDb } from '~/core/database';
import { PinDrizzleRepository } from './pin.drizzle.repository';
import { PinGelRepository } from './pin.gel.repository';
import { PinRepository } from './pin.repository';
import { PinResolver } from './pin.resolver';
import { PinService } from './pin.service';

@Module({
  providers: [
    PinResolver,
    PinService,
    splitDb(PinRepository, {
      gel: PinGelRepository,
      // migration-todo: `as any` + the Neo4j/Gel paths removed at Phase 7
      // cutover when splitDb disappears.
      postgres: PinDrizzleRepository as any,
    }),
  ],
  exports: [PinService],
})
export class PinModule {}
