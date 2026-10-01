import { Module } from '@nestjs/common';
import { PinRepository } from './pin.repository';
import { PinResolver } from './pin.resolver';
import { PinService } from './pin.service';

@Module({
  providers: [PinResolver, PinService, PinRepository],
  exports: [PinService],
})
export class PinModule {}
