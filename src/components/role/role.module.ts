import { Module } from '@nestjs/common';
import * as handlers from './handlers';

@Module({
  providers: [...Object.values(handlers)],
})
export class RoleModule {}
