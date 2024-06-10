import { Module } from '@nestjs/common';
import { splitDb } from '~/core';
import { PinEdgeDBRepository } from './pin.edgedb.repository';
import { PinRepository } from './pin.repository';
import { PinResolver } from './pin.resolver';
import { PinService } from './pin.service';

@Module({
  providers: [
    PinResolver,
    PinService,
    splitDb(PinRepository, PinEdgeDBRepository),
  ],
  exports: [PinService],
})
export class PinModule {}
