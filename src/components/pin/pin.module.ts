import { Module } from '@nestjs/common';
import { splitDb } from '~/core';
import { PinGelRepository } from './pin.gel.repository';
import { PinRepository } from './pin.repository';
import { PinResolver } from './pin.resolver';
import { PinService } from './pin.service';

@Module({
  providers: [
    PinResolver,
    PinService,
    splitDb(PinRepository, PinGelRepository),
  ],
  exports: [PinService],
})
export class PinModule {}
